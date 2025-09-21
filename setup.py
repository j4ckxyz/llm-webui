from setuptools import setup, find_packages

setup(
    name="llm-webui",
    version="0.1.0",
    description="A web-based user interface for the LLM CLI tool",
    long_description=open("README.md").read(),
    long_description_content_type="text/markdown",
    author="j4ckxyz",
    author_email="",
    url="https://github.com/j4ckxyz/llm-webui",
    license="MIT License",
    packages=find_packages(),
    include_package_data=True,
    package_data={
        "llm_webui": ["static/*", "templates/*"],
    },
    install_requires=[
        "llm",
        "fastapi>=0.68.0",
        "uvicorn[standard]>=0.15.0",
        "python-multipart>=0.0.5",
        "jinja2>=3.0.0",
    ],
    extras_require={
        "dev": [
            "pytest",
            "black",
            "flake8",
            "playwright",
        ]
    },
    entry_points={
        "llm": [
            "webui = llm_webui.plugin"
        ]
    },
    python_requires=">=3.8",
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
    ],
)