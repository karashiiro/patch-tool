from http import client
import json
import logging
from typing import Dict
from urllib.parse import urlparse

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def is_url_allowed(url: str) -> bool:
    parsed_url = urlparse(url)
    if parsed_url.scheme != 'http':
        return False
    if parsed_url.netloc not in ('patch01.pso2gs.net', 'download.pso2.jp', 'sub-download.pso2.jp'):
        return False
    return True


def extract_headers(res: client.HTTPResponse) -> Dict[str, str]:
    return dict(res.getheaders())


def handler(event, context):
    # Process the body data
    body = event['body']
    data = json.loads(body)
    if 'url' not in data:
        logger.error('No URL received in the request body object: %s', body)
        return {
            'statusCode': 400,
            'headers': {
                'Content-Type': 'application/json',
            },
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
            'headers': {
                'Content-Type': 'application/json',
            },
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
            'headers': {
                'Content-Type': 'application/json',
            },
            'body': json.dumps({
                'message': 'Invalid URL provided.',
            }),
        }

    # Make the request
    logger.info('Making request to %s://%s%s', parsed_url.scheme,
                parsed_url.hostname, parsed_url.path)
    conn = client.HTTPConnection(parsed_url.hostname, parsed_url.port)
    conn.request('GET', parsed_url.path, headers={
        'User-Agent': 'AQUA_HTTP',
    })

    res = conn.getresponse()
    logger.info('Response status: %d %s', res.status, res.reason)
    body = str(res.read(), encoding='utf-8')

    return {
        'statusCode': res.status,
        'headers': extract_headers(res),
        'body': body,
    }
