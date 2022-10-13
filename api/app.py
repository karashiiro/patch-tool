#!/usr/bin/env python3
import aws_cdk as cdk

from api.api_stack import ApiStack


app = cdk.App()
ApiStack(app, 'ApiStack')

app.synth()
