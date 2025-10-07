import re

def parse_vtt_to_custom_format(vtt_content):
    """
    Parses VTT content and converts it to a custom format.
    
    The new format is:
    0
    Subtitle content
    Potentially multi-line subtitle content

    1
    Another subtitle content
    Another potentially multi-line subtitle content
    """
    lines = vtt_content.strip().split('\n')
    
    # Filter out WEBVTT header, timestamps, and empty lines
    subtitle_lines = []
    is_subtitle = False
    for line in lines:
        if "-->" in line:
            is_subtitle = True
            continue
        if line.strip() == "" or line.strip().isdigit() or "WEBVTT" in line:
            is_subtitle = False
            continue
        if is_subtitle:
            subtitle_lines.append(line.strip())

    # Group subtitles that might have been on separate lines but belong to the same timestamp
    cues = []
    current_cue = ""
    lines = vtt_content.strip().split('\n')
    temp_cue = []

    for line in lines:
        line = line.strip()
        if "-->" in line:
            if temp_cue:
                cues.append("\n".join(temp_cue))
                temp_cue = []
        elif line and not line.isdigit() and "WEBVTT" not in line:
            temp_cue.append(line)
    if temp_cue:
        cues.append("\n".join(temp_cue))

    # Format the cues into the desired output format
    formatted_output = []
    for i, cue in enumerate(cues):
        formatted_output.append(str(i))
        formatted_output.append(cue)
        formatted_output.append("")  # Add a blank line for separation

    return "\n".join(formatted_output)

def process_vtt_file(input_path, output_path):
    """
    Reads a VTT file, parses it, and saves it to a new format.
    """
    try:
        with open(input_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        formatted_content = parse_vtt_to_custom_format(content)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(formatted_content)
            
        print(f"Successfully converted '{input_path}' to '{output_path}'")
    except FileNotFoundError:
        print(f"Error: Input file not found at '{input_path}'")
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == '__main__':
    # Example usage:
    input_file = '01.0101--copy.vtt'
    output_file = 'formatted_subtitles.txt'
    process_vtt_file(input_file, output_file)
