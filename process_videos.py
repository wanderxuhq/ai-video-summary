import os
import glob
from transcription import load_whisper_model, transcribe_audio

def main():
    """
    主函数，用于加载模型并处理多个音频文件。
    """
    # --- 配置 ---
    MODEL_NAME = "large"
    # 定义要处理的音频文件所在的目录
    AUDIO_DIRECTORY = "." 
    # 定义文件匹配模式，例如 "*.mp3", "*.wav" 等
    FILE_PATTERN = "*.mp3"

    # --- 1. 加载模型 (只执行一次) ---
    print("--- 正在初始化并加载 Whisper 模型 ---")
    model = load_whisper_model(MODEL_NAME)

    if not model:
        print("模型加载失败，程序退出。")
        return

    # --- 2. 查找所有匹配的音频文件 ---
    # 你可以修改这里的逻辑来处理特定的文件列表
    search_path = os.path.join(AUDIO_DIRECTORY, FILE_PATTERN)
    audio_files = glob.glob(search_path)

    if not audio_files:
        print(f"在目录 '{AUDIO_DIRECTORY}' 中未找到匹配 '{FILE_PATTERN}' 的文件。")
        return
        
    print(f"\n--- 找到 {len(audio_files)} 个音频文件, 准备开始处理 ---")
    print(audio_files)

    # --- 3. 遍历并处理每个音频文件 ---
    for i, audio_file in enumerate(audio_files):
        print(f"\n\n=============================================")
        print(f"===> 正在处理第 {i+1}/{len(audio_files)} 个文件: {audio_file}")
        print(f"=============================================")
        transcribe_audio(model, audio_file)

    print("\n\n--- 所有任务已完成 ---")


if __name__ == '__main__':
    main()
