import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'ragnarock-phase1-dr-benchmark-secret-key-change-in-prod')

DEBUG = os.environ.get('DJANGO_DEBUG', 'False').lower() in ('true', '1', 'yes')

ALLOWED_HOSTS = ['*']  # Behind AWS ALB / Azure ALB / API Gateway

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'dr_benchmark.apps.DrBenchmarkConfig',
]

MIDDLEWARE = [
    'ragnarock.middleware.DRHeaderMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'ragnarock.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'ragnarock.wsgi.application'

# Database Configuration (Multi-Cloud Dual Connection with SQLite local dev fallback)
USE_SQLITE = os.environ.get('USE_SQLITE', 'True').lower() in ('true', '1', 'yes')

if USE_SQLITE:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        },
        'azure_secondary': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'azure.sqlite3',
        }
    }
else:
    DB_ENGINE = os.environ.get('DB_ENGINE', 'django.db.backends.postgresql')
    AWS_DB_NAME = os.environ.get('AWS_DB_NAME', 'ragnarock_db')
    AWS_DB_USER = os.environ.get('AWS_DB_USER', 'ragnarock_admin')
    AWS_DB_PASSWORD = os.environ.get('AWS_DB_PASSWORD', 'ragnarock_secure_pass_2026')
    AWS_DB_HOST = os.environ.get('AWS_DB_HOST', 'localhost')
    AWS_DB_PORT = os.environ.get('AWS_DB_PORT', '5432')

    AZURE_DB_NAME = os.environ.get('AZURE_DB_NAME', 'ragnarock_db')
    AZURE_DB_USER = os.environ.get('AZURE_DB_USER', 'ragnarock_admin')
    AZURE_DB_PASSWORD = os.environ.get('AZURE_DB_PASSWORD', 'ragnarock_secure_pass_2026')
    AZURE_DB_HOST = os.environ.get('AZURE_DB_HOST', 'localhost')
    AZURE_DB_PORT = os.environ.get('AZURE_DB_PORT', '5433')

    DATABASES = {
        'default': {
            'ENGINE': DB_ENGINE,
            'NAME': AWS_DB_NAME,
            'USER': AWS_DB_USER,
            'PASSWORD': AWS_DB_PASSWORD,
            'HOST': AWS_DB_HOST,
            'PORT': AWS_DB_PORT,
            'CONN_MAX_AGE': 60,
            'OPTIONS': {
                'connect_timeout': 3,
            }
        },
        'azure_secondary': {
            'ENGINE': DB_ENGINE,
            'NAME': AZURE_DB_NAME,
            'USER': AZURE_DB_USER,
            'PASSWORD': AZURE_DB_PASSWORD,
            'HOST': AZURE_DB_HOST,
            'PORT': AZURE_DB_PORT,
            'CONN_MAX_AGE': 60,
            'OPTIONS': {
                'connect_timeout': 3,
            }
        }
    }

# Dynamic Cross-Cloud DR Database Router
DATABASE_ROUTERS = ['ragnarock.db_router.MultiCloudDRDatabaseRouter']

# REST Framework Configuration
REST_FRAMEWORK = {
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
    'DEFAULT_PARSER_CLASSES': [
        'rest_framework.parsers.JSONParser',
    ],
}

# Node Metadata & Telemetry
CLOUD_PROVIDER = os.environ.get('CLOUD_PROVIDER', 'AWS')  # 'AWS' or 'AZURE'
CLOUD_REGION = os.environ.get('CLOUD_REGION', 'us-east-1')  # 'us-east-1' or 'eastus'
NODE_ID = os.environ.get('NODE_ID', 'node-aws-01')

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
