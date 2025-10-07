# AI 视频摘要

[English](./README.md)

本项目是一个旨在自动为视频生成摘要和字幕的工具。

## 如何在本地运行

1.  **环境要求**:
    *   **Python**: 确保您的电脑已安装 Python。
    *   **FFmpeg**: 本项目需要 `ffmpeg`。您可以通过常见的包管理器进行安装：
      ```bash
      # Ubuntu 或 Debian
      sudo apt update && sudo apt install ffmpeg

      # Arch Linux
      sudo pacman -S ffmpeg

      # macOS (使用 Homebrew)
      brew install ffmpeg

      # Windows (使用 Chocolatey)
      choco install ffmpeg

      # Windows (使用 Scoop)
      scoop install ffmpeg
      ```

2.  **配置**:
    *   将根目录下的 `config.json.example` 文件复制一份，重命名为 `config.json`。
    *   编辑 `config.json` 文件，填入您自己的 OpenAI API 密钥。

3.  **安装依赖**:
    ```bash
    pip install -r requirements.txt
    ```

4.  **启动应用**:
    ```bash
    python main.py
    ```

5.  **访问应用**:
    打开浏览器，访问 `http://127.0.0.1:5000` 即可开始使用。
