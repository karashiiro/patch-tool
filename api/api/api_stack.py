from aws_cdk import Stack, aws_lambda as lambda_, aws_apigateway as apigw
from constructs import Construct


class ApiStack(Stack):
    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        aqua_proxy_lambda = lambda_.Function(self, 'AquaProxyLambda', handler='aqua_proxy.handler',
                                             runtime=lambda_.Runtime.PYTHON_3_8, code=lambda_.Code.from_asset('lambda'))

        api = apigw.RestApi(self, 'AquaProxyApiGateway',
                            rest_api_name='AquaProxyApiGateway')
        api.add_usage_plan('AquaProxyGlobalRateLimit',
                           throttle=apigw.ThrottleSettings(rate_limit=100))
        api_entity = api.root.add_resource(
            'aqua-proxy',
            default_cors_preflight_options=apigw.CorsOptions(
                allow_methods=['POST', 'OPTIONS'],
                allow_origins=apigw.Cors.ALL_ORIGINS)
        )
        aqua_proxy_lambda_integration = apigw.LambdaIntegration(
            aqua_proxy_lambda,  # type: ignore
            proxy=True,
        )
        api_entity.add_method(
            'POST',
            aqua_proxy_lambda_integration,
        )
