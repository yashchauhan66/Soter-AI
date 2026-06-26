from setuptools import setup, find_packages

setup(
    name="langflow-components-soterai",
    version="0.1.0",
    description="SoterAI components for Langflow — AI security guardrails",
    author="SoterAI",
    author_email="support@soterai.dev",
    url="https://github.com/SoterAI/langflow-components-soterai",
    py_modules=["soter_guard_component"],
    python_requires=">=3.9",
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
    ],
)
