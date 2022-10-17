from aws_cdk import Duration, Stack, aws_lambda as lambda_, aws_s3 as s3, aws_apigateway as apigw
from constructs import Construct


class ApiStack(Stack):
    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # Create a bucket to store patch data in so that we don't
        # have Lambdas running for extended periods of time trying
        # to return large patch files. Even setting a Lambda timeout
        # of 20s with 512MB of memory wasn't enough to download the
        # NGS patch list on-demand.
        aqua_proxy_bucket = s3.Bucket(
            self,
            'AquaProxyBucket',
            access_control=s3.BucketAccessControl.BUCKET_OWNER_FULL_CONTROL,
            encryption=s3.BucketEncryption.S3_MANAGED,
            public_read_access=True,
            lifecycle_rules=[
                # Because we're using S3 like a cache, deleting data
                # very quickly is perfectly fine.
                s3.LifecycleRule(expiration=Duration.days(1)),
            ],
        )

        # Allow web clients to download S3 objects
        aqua_proxy_bucket.add_cors_rule(
            allowed_methods=[s3.HttpMethods.GET],
            allowed_origins=['*'],
        )

        # Create the proxy API
        aqua_proxy_lambda = lambda_.Function(
            self,
            'AquaProxyLambda',
            handler='aqua_proxy.handler',
            runtime=lambda_.Runtime.PYTHON_3_8,
            code=lambda_.Code.from_asset('lambda'),
            environment={
                'bucket': aqua_proxy_bucket.bucket_name,
                'bucket_address': aqua_proxy_bucket.bucket_regional_domain_name,
            },
            timeout=Duration.seconds(5),
        )

        aqua_proxy_bucket.grant_read_write(aqua_proxy_lambda)

        api = apigw.RestApi(
            self,
            'AquaProxyApiGateway',
            rest_api_name='AquaProxyApiGateway',
        )

        api.add_usage_plan(
            'AquaProxyGlobalRateLimit',
            throttle=apigw.ThrottleSettings(rate_limit=100),
        )

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
