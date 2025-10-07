import webvtt
from io import StringIO

def parse_vtt_to_segments(vtt_content):
    """
    使用 webvtt-py 库将 VTT 格式的字符串内容解析为一个 segment 列表。
    每个 segment 是一个包含 'start', 'end', 'text' 键的字典。
    """
    # webvtt-py 需要一个类似文件的对象，我们使用 StringIO 来包装字符串
    # 确保在开头加上 WEBVTT 头，因为临时文件可能没有
    if not vtt_content.strip().startswith("WEBVTT"):
        vtt_content = "WEBVTT\n\n" + vtt_content

    vtt_file_like = StringIO(vtt_content)
    
    segments = []
    try:
        # 从缓冲区读取并解析 VTT 内容
        for caption in webvtt.read_buffer(vtt_file_like):
            segments.append({
                'start': caption.start,
                'end': caption.end,
                'text': caption.text.strip().replace('\n', ' ') # 将多行字幕合并为一行
            })
    except Exception as e:
        print(f"使用 webvtt-py 解析 VTT 内容时出错: {e}")
        pass
        
    return segments
