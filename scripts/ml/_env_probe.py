import importlib

for m in ["datasets", "transformers", "torch", "huggingface_hub", "onnxruntime", "onnx", "sklearn"]:
    try:
        mod = importlib.import_module(m)
        print("{:16} OK   {}".format(m, getattr(mod, "__version__", "?")))
    except Exception:
        print("{:16} MISSING".format(m))

try:
    import torch

    print("cuda_available:", torch.cuda.is_available())
    print("cpu_threads:", torch.get_num_threads())
except Exception:
    pass

try:
    from huggingface_hub import HfApi

    print("HF_user:", HfApi().whoami().get("name"))
except Exception as e:
    print("HF_login: NOT_LOGGED_IN", type(e).__name__)
