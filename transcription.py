import torch
import whisper
import os
import math
import glob
from vtt_utils import parse_vtt_to_segments

def load_whisper_model(model_name="large"):
    """
    加载 Whisper 模型并返回模型实例。
    """
    print(f"PyTorch version: {torch.__version__}")
    print(f"CUDA available: {torch.cuda.is_available()}")
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Using device: {device}")

    try:
        print(f"正在加载 Whisper 模型: '{model_name}'...")
        model = whisper.load_model(model_name, device=device)
        print("模型加载成功。")
        return model
    except Exception as e:
        print(f"加载模型时出错: {e}")
        return None

def format_timestamp(seconds: float) -> str:
    """
    将秒数格式化为 VTT 时间戳字符串。
    """
    assert seconds >= 0, "non-negative timestamp expected"
    milliseconds = round(seconds * 1000.0)
    hours, milliseconds = divmod(milliseconds, 3_600_000)
    minutes, milliseconds = divmod(milliseconds, 60_000)
    seconds, milliseconds = divmod(milliseconds, 1_000)
    return f"{int(hours):02d}:{int(minutes):02d}:{int(seconds):02d}.{int(milliseconds):03d}"

def transcribe_audio(model, audio_file, socketio=None, base_filename=None, original_filename=None, chunk_seconds=30):
    """
    使用加载好的模型对指定的音频文件进行转写，并通过 Socket.IO 发送实时进度。
    """
    # --- 目录配置 ---
    DATA_FOLDER = 'data'
    os.makedirs(DATA_FOLDER, exist_ok=True)

    if not model:
        print("模型未加载，无法进行转写。")
        return

    # --- 加载音频文件 ---
    try:
        print(f"正在加载音频文件: '{audio_file}'...")
        audio = whisper.load_audio(audio_file)
        sample_rate = whisper.audio.SAMPLE_RATE
        total_samples = audio.shape[0]
        total_seconds = total_samples / sample_rate
        print(f"音频加载成功: 总时长 = {total_seconds:.2f} 秒。")
    except Exception as e:
        print(f"加载音频文件时出错: {e}")
        return

    # --- 边转写边生成临时 VTT 文件 (支持断点续传) ---
    print("\n--- 开始分块转写并实时生成 VTT 片段 ---")
    num_chunks = math.ceil(total_seconds / chunk_seconds)
    chunk_samples = chunk_seconds * sample_rate
    # 如果没有提供 base_filename，则从 audio_file 推断
    if not base_filename:
        base_filename = os.path.splitext(os.path.basename(audio_file))[0]
    
    # 为每个视频在 data 目录下创建一个专属的子目录
    video_folder = os.path.join(DATA_FOLDER, base_filename)
    temp_dir = os.path.join(video_folder, 'tmp') # 临时文件存放在 video_folder/tmp/
    os.makedirs(temp_dir, exist_ok=True)
    print(f"临时文件将保存在目录: '{temp_dir}/'")

    # --- 任务开始时，立即发送一个空数组作为启动信号 ---
    if socketio:
        socketio.emit('new_subtitle_chunk', {
            'filename': base_filename,
            'original_filename': original_filename,
            'segments': []
        })
        socketio.sleep(0.01)

    for i in range(num_chunks):
        start_time = i * chunk_seconds
        end_time = (i + 1) * chunk_seconds
        
        chunk_start_str = f"{int(start_time):05d}s"
        pattern_to_check = os.path.join(temp_dir, f"{chunk_start_str}_*.vtt.tmp")
        
        existing_files = glob.glob(pattern_to_check)
        if existing_files:
            print(f"已找到块 {i+1}/{num_chunks} 的临时文件, 读取并发送内容。")
            try:
                with open(existing_files[0], 'r', encoding='utf-8') as f:
                    tmp_content = f.read()
                
                chunk_segments = parse_vtt_to_segments(tmp_content)
                
                if socketio and chunk_segments:
                    socketio.emit('new_subtitle_chunk', {
                        'filename': base_filename,
                        'original_filename': original_filename,
                        'segments': chunk_segments
                    })
                    socketio.sleep(0.01) # 短暂休眠以确保消息发送
            except Exception as e:
                print(f"读取或解析临时文件 {existing_files[0]} 时出错: {e}")

            continue

        print(f"\n正在处理块 {i+1}/{num_chunks} (时间: {start_time:.2f}s -> {min(end_time, total_seconds):.2f}s)...")

        start_sample = i * chunk_samples
        end_sample = start_sample + chunk_samples
        audio_chunk = audio[start_sample:end_sample]

        result_chunk = model.transcribe(audio_chunk, verbose=None)

        if result_chunk['segments']:
            time_offset = i * chunk_seconds
            
            first_segment_start = result_chunk['segments'][0]['start'] + time_offset
            last_segment_end = result_chunk['segments'][-1]['end'] + time_offset

            real_start_str = format_timestamp(first_segment_start).replace(':', '-').replace('.', '_')
            real_end_str = format_timestamp(last_segment_end).replace(':', '-').replace('.', '_')

            temp_filename = f"{chunk_start_str}_{real_start_str}_to_{real_end_str}.vtt.tmp"
            temp_filepath = os.path.join(temp_dir, temp_filename)

            print(f"检测到语音，正在写入临时文件: {temp_filepath}")
            chunk_segments = []
            with open(temp_filepath, 'w', encoding='utf-8') as f:
                f.write("WEBVTT\n\n")
                for segment in result_chunk['segments']:
                    start_abs = segment['start'] + time_offset
                    end_abs = segment['end'] + time_offset
                    
                    start_ts = format_timestamp(start_abs)
                    end_ts = format_timestamp(end_abs)
                    text = segment['text'].strip()
                    f.write(f"{start_ts} --> {end_ts}\n")
                    f.write(f"{text}\n\n")
                    chunk_segments.append({
                        'start': start_ts,
                        'end': end_ts,
                        'text': text
                    })

            # --- 通过 WebSocket 一次性发送整个块的所有字幕片段 ---
            if socketio and chunk_segments:
                print(f"发送 WebSocket 事件: new_subtitle_chunk for {base_filename}")
                socketio.emit('new_subtitle_chunk', {
                    'filename': base_filename,
                    'original_filename': original_filename,
                    'segments': chunk_segments
                })
                socketio.sleep(0.01)
        else:
            print(f"块 {i+1}: 未检测到语音，跳过生成文件。")
            if socketio:
                # 即使没有内容，也发送一个空数组，让前端知道这个块已经处理完毕
                socketio.emit('new_subtitle_chunk', {
                    'filename': base_filename,
                    'original_filename': original_filename,
                    'segments': []
                })
                socketio.sleep(0.01)

    # --- 合并所有临时 VTT 文件 ---
    temp_files_pattern = os.path.join(temp_dir, "*.vtt.tmp")
    temp_files = sorted(glob.glob(temp_files_pattern))

    if temp_files:
        print(f"\n--- 所有 {len(temp_files)} 个临时文件已生成, 开始合并 ---")
        # 最终文件保存到视频专属目录
        final_vtt_path = os.path.join(video_folder, base_filename + ".vtt")
        with open(final_vtt_path, 'w', encoding='utf-8') as final_f:
            final_f.write("WEBVTT\n\n")
            for temp_filepath in temp_files:
                with open(temp_filepath, 'r', encoding='utf-8') as temp_f:
                    lines = temp_f.readlines()
                    final_f.writelines(lines[2:])

        print(f"--- 合并完成, 字幕文件已保存到: '{final_vtt_path}' ---")
        if socketio:
            print(f"发送 WebSocket 事件: transcription_complete for {base_filename}")
            socketio.emit('transcription_complete', {
                'filename': base_filename,
                'original_filename': original_filename,
                'vtt_path': final_vtt_path
            })
    else:
        print("\n--- 未生成任何临时文件，任务结束 ---")
        if socketio:
            print(f"发送 WebSocket 事件: transcription_error for {base_filename}")
            socketio.emit('transcription_error', {
                'filename': base_filename,
                'original_filename': original_filename,
                'message': '未生成任何字幕文件'
            })

    #可以选择性地删除临时文件
    # for temp_file in temp_files:
    #     os.remove(temp_file)
    # print("\n--- 临时文件已删除 ---")

    print("\n--- 转写任务结束 ---")


if __name__ == '__main__':
    # --- 配置 ---
    MODEL_NAME = "large"
    AUDIO_FILE = "test01.mp3"
    
    # --- 执行 ---
    model = load_whisper_model(MODEL_NAME)
    if model:
        transcribe_audio(model, AUDIO_FILE)
