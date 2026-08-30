#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";

import { WebsiteStack } from "../lib/website-stack";

const app = new cdk.App();

new WebsiteStack(app, "DaniilZinovyevWebsite", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT ?? "104994162766",
    // CloudFront and its ACM certificate are global; the stack must be us-east-1.
    region: "us-east-1",
  },
  description: "Static site, CDN, and TLS for daniilzinovyev.com",
});
