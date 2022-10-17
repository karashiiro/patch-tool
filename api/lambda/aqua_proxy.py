from http import client
import json
import logging
import os
from typing import Dict
from urllib.parse import urlparse
from uuid import uuid4
import boto3


logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client('s3')
bucket = os.environ['bucket']
bucket_address = os.environ['bucket_address']


def get_object_url(key: str) -> str:
    """
    Returns the object URL for the object with the provided key.
    """
    return f"https://{bucket_address}/{key}"


def upload_artifact(artifact: bytes, key: str):
    """
    Uploads the provided artifact to S3.
    """
    s3.put_object(Bucket=bucket, Key=key, Body=artifact)


def has_artifact(key: str) -> bool:
    """
    Returns whether or not the provided key exists in the S3 bucket.
    """
    keys = s3.list_objects_v2(Bucket=bucket, Prefix=key)
    return key in keys


def is_url_allowed(url: str) -> bool:
    """
    Returns True if the provided URL is a valid game data URL;
    otherwise, this returns False.
    """
    parsed_url = urlparse(url)
    if parsed_url.scheme != 'http':
        return False
    if parsed_url.netloc not in ('patch01.pso2gs.net', 'download.pso2.jp', 'sub-download.pso2.jp'):
        return False
    return True


def extract_headers(res: client.HTTPResponse) -> Dict[str, str]:
    """
    Extracts the headers from the provided response and returns
    the result as a regular `dict` object.
    """
    return dict(res.getheaders())


def cors_permissive(headers: Dict[str, str]) -> Dict[str, str]:
    """
    Adds permissive CORS headers to the provided object, overwriting
    any existing ones.
    """
    return {**headers, **{'Access-Control-Allow-Origin': '*'}}


def build_aqua_headers():
    """
    Returns the headers required to access the Aqua patch repository,
    """
    return {
        'User-Agent': 'AQUA_HTTP',
    }


def handler(event, context):
    # Process the body data
    body = event['body']
    data = json.loads(body)
    if 'url' not in data:
        logger.error('No URL received in the request body object: %s', body)
        return {
            'statusCode': 400,
            'headers': cors_permissive({
                'Content-Type': 'application/json',
            }),
            'body': json.dumps({
                'message': 'No URL provided.',
            }),
        }

    # Ensure the URL is a patch data-related URL
    url = data['url']
    if not isinstance(url, str) or not is_url_allowed(url):
        logger.error(
            'Invalid URL received in the request body object: %s', body)
        return {
            'statusCode': 400,
            'headers': cors_permissive({
                'Content-Type': 'application/json',
            }),
            'body': json.dumps({
                'message': 'Invalid URL provided.',
            }),
        }

    parsed_url = urlparse(url)
    if parsed_url.hostname is None:
        logger.error(
            'Invalid URL received in the request body object: %s', body)
        return {
            'statusCode': 400,
            'headers': cors_permissive({
                'Content-Type': 'application/json',
            }),
            'body': json.dumps({
                'message': 'Invalid URL provided.',
            }),
        }

    # Make the request
    logger.info('Making request to %s://%s%s', parsed_url.scheme,
                parsed_url.hostname, parsed_url.path)
    conn = client.HTTPConnection(parsed_url.hostname, parsed_url.port)

    # Start with a headers-only request to see if we need to download
    # an entire file
    conn.request('HEAD', parsed_url.path, headers=build_aqua_headers())
    res = conn.getresponse()

    logger.info('Response status: %d %s', res.status, res.reason)
    logger.info('Response etag: %s', res.headers.get('Etag', ''))

    object_key = res.headers.get('Etag', str(uuid4()))
    object_key = object_key.replace('"', '')

    if has_artifact(object_key):
        return {
            'statusCode': res.status,
            'headers': cors_permissive(extract_headers(res)),
            'body': json.dumps({
                'result': get_object_url(object_key),
            }),
        }

    # Dump anything in the response buffer
    res.read()

    # Download the full file and upload it to S3 for a faster download
    # time in the web application
    conn.request('GET', parsed_url.path, headers=build_aqua_headers())
    res = conn.getresponse()
    try:
        upload_artifact(res.read(), object_key)
    except Exception as e:
        logger.error(e)
        return {
            'statusCode': 500,
            'headers': cors_permissive({
                'Content-Type': 'application/json',
            }),
            'body': json.dumps({
                'message': 'An error occurred.',
            }),
        }

    return {
        'statusCode': res.status,
        'headers': cors_permissive(extract_headers(res)),
        'body': json.dumps({
            'result': get_object_url(object_key),
        }),
    }
