# AI Video Summary

[中文说明](./README_zh.md)

This project is a tool designed to automatically generate summaries and subtitles for videos.

## How to Run Locally

1.  **Prerequisites**:
    *   **Python**: Ensure you have Python installed.
    *   **FFmpeg**: This project requires the `ffmpeg`. It can be installed via most package managers:
      ```bash
      # on Ubuntu or Debian
      sudo apt update && sudo apt install ffmpeg

      # on Arch Linux
      sudo pacman -S ffmpeg

      # on MacOS using Homebrew
      brew install ffmpeg

      # on Windows using Chocolatey
      choco install ffmpeg

      # on Windows using Scoop
      scoop install ffmpeg
      ```

2.  **Configuration**:
    *   Copy the `config.json.example` file to a new file named `config.json`.
    *   Edit `config.json` and fill in your own OpenAI API key.

3.  **Install Dependencies**:
    ```bash
    pip install -r requirements.txt
    ```

4.  **Run the Application**:
    ```bash
    python main.py
    ```

5.  **Access the Application**:
    Open your browser and navigate to `http://127.0.0.1:5000` to start using the tool.
