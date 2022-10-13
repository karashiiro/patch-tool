import aws_cdk as core
import aws_cdk.assertions as assertions

from api.api_stack import ApiStack

# example tests. To run these tests, uncomment this file along with the example
# resource in api/api_stack.py
def test_sqs_queue_created():
    app = core.App()
    stack = ApiStack(app, "api")
    template = assertions.Template.from_stack(stack)

#     template.has_resource_properties("AWS::SQS::Queue", {
#         "VisibilityTimeout": 300
#     })
