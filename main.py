from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO
import os
from werkzeug.utils import secure_filename
import datetime
import threading
import json
import re
import time
from transcription import load_whisper_model, transcribe_audio
from openai_client import get_openai_client
from vtt_utils import parse_vtt_to_segments

# --- 全局变量 ---
WHISPER_MODEL = None
OPENAI_CLIENT = None
APP_CONFIG = {}
PROMPT_TEMPLATE = ""

def load_dependencies():
    """加载所有依赖项：模型、配置、客户端等"""
    global WHISPER_MODEL, OPENAI_CLIENT, APP_CONFIG, PROMPT_TEMPLATE
    
    # 加载 Whisper 模型
    print("后台线程：开始加载 Whisper 模型...")
    WHISPER_MODEL = load_whisper_model("turbo") 
    if WHISPER_MODEL:
        print("后台线程：Whisper 模型加载完毕。")
    else:
        print("后台线程：Whisper 模型加载失败。")

    # 加载应用配置
    print("后台线程：开始加载 config.json...")
    try:
        with open('config.json', 'r', encoding='utf-8') as f:
            APP_CONFIG = json.load(f)
        print("后台线程：config.json 加载成功。")
    except Exception as e:
        print(f"后台线程：加载 config.json 失败: {e}")
        return

    # 加载 Prompt summary模板
    print("后台线程：开始加载 prompt_summary.txt...")
    try:
        with open('prompt_summary.txt', 'r', encoding='utf-8') as f:
            PROMPT_TEMPLATE = f.read()
        print("后台线程：prompt_summary.txt 加载成功。")
    except Exception as e:
        print(f"后台线程：加载 prompt_summary.txt 失败: {e}")
        return

    # 初始化 OpenAI 客户端
    print("后台线程：开始初始化 OpenAI 客户端...")
    try:
        openai_config = APP_CONFIG.get('openai', {})
        OPENAI_CLIENT = get_openai_client(
            api_key=openai_config.get('api_key'),
            base_url=openai_config.get('base_url'),
            proxy=openai_config.get('proxy')
        )
        print("后台线程：OpenAI 客户端初始化成功。")
    except Exception as e:
        print(f"后台线程：初始化 OpenAI 客户端失败: {e}")

app = Flask(__name__, static_folder='static', static_url_path='')
CORS(app) # 同时为 HTTP 端点启用 CORS
socketio = SocketIO(app, cors_allowed_origins="*")

# --- 配置 ---
DATA_FOLDER = 'data'
ALLOWED_EXTENSIONS = {'mp4', 'mp3', 'wav'}

# --- 确保根数据目录存在 ---
os.makedirs(DATA_FOLDER, exist_ok=True)

def allowed_file(filename):
    """检查文件扩展名是否在允许范围内"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def stream_existing_vtt(vtt_filepath, base_filename):
    """读取已有的 VTT 文件并分块通过 WebSocket 发送"""
    print(f"开始流式发送已存在的 VTT 文件: {vtt_filepath}")
    try:
        with open(vtt_filepath, 'r', encoding='utf-8') as f:
            vtt_content = f.read()
        
        segments = parse_vtt_to_segments(vtt_content)
        
        chunk_size = 10  # 每次发送10条字幕
        for i in range(0, len(segments), chunk_size):
            chunk = segments[i:i+chunk_size]
            socketio.emit('new_subtitle_chunk', {
                'filename': base_filename,
                'segments': chunk
            })
            print(f"为 {base_filename} 发送了 {len(chunk)} 条字幕")
            # socketio.sleep(0.1) # 移除不必要的延迟

        socketio.emit('transcription_complete', {
            'filename': base_filename,
            'vtt_path': vtt_filepath
        })
        print(f"VTT 文件 '{base_filename}' 发送完成。")

    except Exception as e:
        print(f"流式发送 VTT 文件时出错: {e}")
        socketio.emit('transcription_error', {
            'filename': base_filename,
            'message': f"读取或解析现有字幕文件时出错: {e}"
        })

@app.route('/pre-upload', methods=['POST'])
def pre_upload_check():
    """检查字幕文件是否已存在。如果存在，直接返回其内容。"""
    data = request.get_json()
    if not data or 'filename' not in data:
        return jsonify({"error": "请求中缺少文件名"}), 400

    filename = secure_filename(data['filename'])
    print(f"[{datetime.datetime.now()}] Pre-upload check for: {filename}")

    base_filename, _ = os.path.splitext(filename)
    video_folder = os.path.join(DATA_FOLDER, base_filename)
    vtt_filepath = os.path.join(video_folder, f"{base_filename}.vtt")

    if os.path.exists(vtt_filepath):
        print(f"找到字幕文件: {vtt_filepath}, 直接通过 HTTP 响应发送。")
        try:
            with open(vtt_filepath, 'r', encoding='utf-8') as f:
                vtt_content = f.read()
            return jsonify({
                "message": "字幕文件已存在",
                "action": "load_subtitles",
                "subtitles": vtt_content
            }), 200
        except Exception as e:
            return jsonify({"error": f"读取字幕文件时出错: {e}"}), 500
    else:
        print(f"未找到字幕文件: {vtt_filepath}")
        return jsonify({
            "message": "未找到字幕文件，请上传",
            "action": "proceed_upload"
        }), 204

@app.route('/upload', methods=['POST'])
def upload_file():
    """
    处理文件上传并自动触发后台转写。
    这个端点假设 pre-upload 检查已经完成，并且需要进行转写。
    """
    if 'file' not in request.files:
        return jsonify({"error": "请求中没有文件部分"}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({"error": "没有选择文件"}), 400
        
    if not file or not allowed_file(file.filename):
        return jsonify({"error": "不允许的文件类型"}), 400

    if WHISPER_MODEL is None:
        return jsonify({"error": "模型正在加载中，请稍后再试"}), 503

    filename = secure_filename(file.filename)
    base_filename, _ = os.path.splitext(filename)
    
    # --- 创建视频专属目录并保存文件 ---
    video_folder = os.path.join(DATA_FOLDER, base_filename)
    os.makedirs(video_folder, exist_ok=True)
    filepath = os.path.join(video_folder, filename)
    
    try:
        file.save(filepath)
    except Exception as e:
        return jsonify({"error": f"保存文件时出错: {e}"}), 500
    
    print(f"为 '{filename}' 启动后台转写线程。")
    socketio.start_background_task(
        transcribe_audio,
        model=WHISPER_MODEL,
        audio_file=filepath,
        socketio=socketio,
        base_filename=base_filename,
        original_filename=file.filename # 传递原始文件名
    )

    return jsonify({
        "message": "文件上传成功，转写任务已在后台启动",
        "filename": filename
    }), 202

@app.route('/status', methods=['GET'])
def status():
    """检查模型加载状态"""
    if WHISPER_MODEL and OPENAI_CLIENT:
        return jsonify({"status": "ready", "message": "所有服务已就绪"}), 200
    elif WHISPER_MODEL:
        return jsonify({"status": "loading", "message": "OpenAI 客户端正在初始化..."}), 202
    else:
        return jsonify({"status": "loading", "message": "Whisper 模型正在加载中..."}), 202

@app.route('/summary', methods=['POST'])
def get_summary():
    """根据 VTT 字幕内容生成摘要，并实现缓存"""
    data = request.get_json()
    if not data or 'filename' not in data:
        return jsonify({"error": "请求中缺少文件名"}), 400

    filename = secure_filename(data['filename'])
    base_filename, _ = os.path.splitext(filename)
    
    # --- 检查缓存 ---
    video_folder = os.path.join(DATA_FOLDER, base_filename)
    summary_filepath = os.path.join(video_folder, f"{base_filename}.md")
    
    if os.path.exists(summary_filepath):
        try:
            with open(summary_filepath, 'r', encoding='utf-8') as f:
                summary_content = f.read()
            print(f"找到摘要缓存: '{summary_filepath}'")
            return jsonify({"summary": summary_content}), 200
        except Exception as e:
            print(f"读取摘要缓存文件时出错: {e}")
            # 如果读取缓存失败，则继续执行生成流程

    # --- 如果没有缓存，则生成摘要 ---
    if not OPENAI_CLIENT or not PROMPT_TEMPLATE:
        return jsonify({"error": "摘要服务尚未完全初始化，请稍后重试"}), 503

    vtt_filepath = os.path.join(video_folder, f"{base_filename}.vtt")

    if not os.path.exists(vtt_filepath):
        return jsonify({"error": "找不到对应的字幕文件"}), 404

    try:
        with open(vtt_filepath, 'r', encoding='utf-8') as f:
            vtt_content = f.read()
    except Exception as e:
        return jsonify({"error": f"读取字幕文件时出错: {e}"}), 500

    final_prompt = PROMPT_TEMPLATE + "\n\n" + vtt_content

    try:
        print(f"未找到缓存，正在为 '{base_filename}.vtt' 请求 OpenAI 摘要...")
        openai_config = APP_CONFIG.get('openai', {})
        model = openai_config.get('model', 'gpt-3.5-turbo')

        response = OPENAI_CLIENT.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "你是一位专业的视频内容结构分析师。"},
                {"role": "user", "content": final_prompt}
            ]
        )
        summary = response.choices[0].message.content
        print(f"成功获取 '{base_filename}.vtt' 的摘要。")

        # --- 保存到缓存文件 ---
        try:
            with open(summary_filepath, 'w', encoding='utf-8') as f:
                f.write(summary)
            print(f"摘要已缓存到: '{summary_filepath}'")
        except Exception as e:
            print(f"保存摘要缓存文件时出错: {e}")

        return jsonify({"summary": summary}), 200

    except Exception as e:
        print(f"请求 OpenAI API 时出错: {e}")
        return jsonify({"error": f"请求 OpenAI API 时出错: {e}"}), 500

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    """服务前端静态文件和 index.html"""
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    # --- 启动后台线程加载所有依赖 ---
    print("主线程：准备启动依赖加载线程...")
    loader_thread = threading.Thread(target=load_dependencies)
    loader_thread.daemon = True
    loader_thread.start()

    # --- 启动 Web 服务器 ---
    print("主线程：服务器正在通过 SocketIO 启动，监听 http://0.0.0.0:5000")
    # 使用 eventlet 或 gevent 性能更佳，但此处为简单起见，使用 Werkzeug 开发服务器
    # 注意: allow_unsafe_werkzeug=True 适用于开发环境
    socketio.run(app, host='0.0.0.0', port=5000, allow_unsafe_werkzeug=True)
