from pathlib import Path
import environ

def read_env_files(env_filenames):
    dot_env_dir = Path(__file__).resolve().parent.parent.parent.parent

    for env_filename in env_filenames:
        env_file = dot_env_dir / env_filename
        if env_file.exists():
            environ.Env.read_env(dot_env_dir / env_file)
