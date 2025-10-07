import os
from openai import OpenAI

try:
    import httpx
except ImportError:
    httpx = None

def get_openai_client(api_key=None, base_url=None, proxy=None):
    """
    获取一个 OpenAI API 客户端实例。

    Args:
        api_key (str, optional): OpenAI API 密钥。如果未提供，将尝试从环境变量 'OPENAI_API_KEY' 读取。
        base_url (str, optional): API 的基础 URL。如果未提供，将尝试从环境变量 'OPENAI_BASE_URL' 读取。
        proxy (str, optional): 代理服务器地址 (例如 'http://127.0.0.1:7890')。

    Returns:
        OpenAI: 配置好的 OpenAI 客户端实例。
    """
    if api_key is None:
        api_key = os.environ.get("OPENAI_API_KEY")
    
    if base_url is None:
        base_url = os.environ.get("OPENAI_BASE_URL")

    if not api_key:
        raise ValueError("未提供 API 密钥，也未在环境变量 'OPENAI_API_KEY' 中找到。")

    http_client = None
    # 确保 proxy 是一个非空字符串
    if proxy and isinstance(proxy, str) and proxy.strip():
        if httpx is None:
            raise ImportError("要使用代理功能，请先安装 'httpx' 库 (pip install httpx)。")
        
        # 使用更明确的字典格式来设置代理
        proxies = {
            "http://": proxy,
            "https://": proxy,
        }
        print(f"后台线程：正在使用代理: {proxies}")
        http_client = httpx.Client(proxy=proxy)

    client = OpenAI(
        api_key=api_key,
        base_url=base_url,
        http_client=http_client
    )
    
    return client

if __name__ == '__main__':
    # 这是一个如何使用它的示例
    # 在实际使用前，请确保设置了环境变量或直接传入参数

    # 示例 1: 从环境变量加载配置 (无代理)
    # 运行前请设置:
    # export OPENAI_API_KEY="sk-..."
    # export OPENAI_BASE_URL="https://api.openai.com/v1"
    try:
        print("尝试从环境变量初始化客户端...")
        client_from_env = get_openai_client()
        print("客户端初始化成功 (从环境变量)!")
        # response = client_from_env.chat.completions.create(
        #     model="gpt-3.5-turbo",
        #     messages=[{"role": "user", "content": "你好"}]
        # )
        # print("API 调用成功:", response.choices[0].message.content)
    except (ValueError, ImportError) as e:
        print(f"从环境变量初始化失败: {e}")
        print("请确保已安装 'httpx' 库 (pip install httpx) 并设置了 OPENAI_API_KEY。")


    # 示例 2: 直接传入参数 (带代理)
    print("\n尝试直接传入参数初始化客户端 (带代理)...")
    try:
        # 替换为你的实际信息
        my_api_key = "YOUR_API_KEY"  # 替换为你的 API Key
        my_proxy = "http://127.0.0.1:7890" # 替换为你的代理地址

        if my_api_key == "YOUR_API_KEY":
            print("请在代码中替换 'YOUR_API_KEY' 为你的真实密钥。")
        else:
            client_with_proxy = get_openai_client(api_key=my_api_key, proxy=my_proxy)
            print("客户端初始化成功 (带代理)!")
            # response = client_with_proxy.chat.completions.create(
            #     model="gpt-3.5-turbo",
            #     messages=[{"role": "user", "content": "你好"}]
            # )
            # print("API 调用成功:", response.choices[0].message.content)

    except (ValueError, ImportError) as e:
        print(f"带代理初始化失败: {e}")
        print("请确保已安装 'httpx' 库 (pip install httpx)。")
