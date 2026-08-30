import * as path from "node:path";

import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  StackProps,
} from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import { Construct } from "constructs";

const DOMAIN = "daniilzinovyev.com";
const WWW = `www.${DOMAIN}`;

/**
 * The certificate is referenced by ARN rather than created here on purpose.
 * DNS for this domain lives at Namecheap, not Route 53, so CDK cannot write
 * the validation records. Letting CDK own the certificate would mean a manual
 * revalidation every time it was replaced; referencing the existing issued one
 * costs nothing and can never break TLS on a deploy.
 *
 * To rotate it: request a new certificate in ACM (us-east-1) covering both
 * `daniilzinovyev.com` and `www.daniilzinovyev.com`, add the CNAME validation
 * records at Namecheap, then swap the ARN below.
 */
const CERTIFICATE_ARN =
  "arn:aws:acm:us-east-1:104994162766:certificate/be95e35a-99df-4235-bcbc-028e9e49d4d9";

/** Built site, relative to this file. */
const SITE_DIST = path.join(__dirname, "..", "..", "dist");

export class WebsiteStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    /**
     * The bucket and distribution below already existed before this stack did,
     * so they are adopted with `cdk import` rather than recreated. A
     * CloudFormation import changeset may contain nothing but IMPORT actions,
     * which is why the deployment machinery is gated behind this flag.
     *
     *   one time:  npm run import   (see infra/README.md)
     *   from then: npm run deploy
     */
    const importMode = this.node.tryGetContext("importMode") === "true";

    /**
     * Served through CloudFront via the S3 *website* endpoint, which is what
     * makes bare directory paths resolve to index.html without needing a
     * CloudFront Function. That endpoint only speaks HTTP and only to anonymous
     * callers, hence the public read policy. Nothing private is stored here.
     */
    const bucket = new s3.Bucket(this, "SiteBucket", {
      bucketName: DOMAIN,
      websiteIndexDocument: "index.html",
      publicReadAccess: true,
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: false,
        blockPublicPolicy: false,
        ignorePublicAcls: false,
        restrictPublicBuckets: false,
      }),
      // The site is rebuildable from git, but a stack delete should not be what
      // takes the domain offline.
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const certificate = acm.Certificate.fromCertificateArn(
      this,
      "SiteCertificate",
      CERTIFICATE_ARN,
    );

    const origin = new origins.S3StaticWebsiteOrigin(bucket);

    const distribution = new cloudfront.Distribution(this, "SiteDistribution", {
      comment: `${DOMAIN} static site`,
      domainNames: [DOMAIN, WWW],
      certificate,
      httpVersion: cloudfront.HttpVersion.HTTP2,
      enableIpv6: true,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_ALL,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      defaultBehavior: {
        origin,
        viewerProtocolPolicy:
          cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true,
      },
      /**
       * Vite fingerprints every asset filename, so those are safe on the long
       * default TTL. The HTML entry point is not fingerprinted, so it gets a
       * short one: a deploy stays visible even if an invalidation is missed.
       */
      additionalBehaviors: importMode
        ? undefined
        : {
            "/index.html": {
              origin,
              viewerProtocolPolicy:
                cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
              cachePolicy: new cloudfront.CachePolicy(this, "HtmlCachePolicy", {
                cachePolicyName: "daniilzinovyev-html",
                comment: "Short TTL for the non-fingerprinted HTML entry point",
                defaultTtl: Duration.minutes(5),
                minTtl: Duration.seconds(0),
                maxTtl: Duration.hours(1),
                enableAcceptEncodingGzip: true,
                enableAcceptEncodingBrotli: true,
              }),
              compress: true,
            },
          },
    });

    // Same reasoning as the bucket: tearing the stack down should not be what
    // takes the domain offline, and a replaced distribution means new DNS.
    distribution.applyRemovalPolicy(RemovalPolicy.RETAIN);

    /**
     * Uploads `dist/` and invalidates the CDN in one step, so `cdk deploy` is
     * the entire release. `prune` deletes objects no longer present in the
     * build, which is what finally clears the old particles.js site out.
     */
    if (!importMode) {
      new s3deploy.BucketDeployment(this, "DeploySite", {
        sources: [s3deploy.Source.asset(SITE_DIST)],
        destinationBucket: bucket,
        distribution,
        distributionPaths: ["/*"],
        prune: true,
        retainOnDelete: false,
        memoryLimit: 512,
      });
    }

    new CfnOutput(this, "BucketName", { value: bucket.bucketName });
    new CfnOutput(this, "DistributionId", {
      value: distribution.distributionId,
    });
    new CfnOutput(this, "DistributionDomain", {
      value: distribution.distributionDomainName,
    });
    new CfnOutput(this, "SiteUrl", { value: `https://${WWW}/` });
  }
}
