/**
 * Everything the site renders, in one place.
 *
 * The résumé is authored separately in `resume/resume.html` because it needs
 * different phrasing (terser bullets, a phone number, no marketing voice). When
 * a fact changes here, change it there too.
 */

export const profile = {
  name: "Daniil Zinovyev",
  title: "Senior Software Development Engineer",
  company: "Amazon",
  location: "Toronto, Canada",
  email: "daniil@daniilzinovyev.com",
  resume: "/Resume.pdf",
  links: {
    github: "https://github.com/DanZinov",
    linkedin: "https://www.linkedin.com/in/daniilzinovyev",
    instagram: "https://www.instagram.com/danielznv/?hl=en",
  },
  intro: [
    "I build large-scale distributed systems at Amazon, and ship complete products on my own time: mobile apps, serverless backends, and the AWS infrastructure underneath them.",
    "Most of what I make lives end to end. I design the data model, write the API, build the client, define the infrastructure as code, and put it in front of real users.",
  ],
};

export type Project = {
  name: string;
  tagline: string;
  description: string;
  stack: string[];
  href?: string;
  icon?: string;
  accent: string;
};

/** Personal projects, most substantial first. */
export const projects: Project[] = [
  {
    name: "Halvy",
    tagline: "Shared expenses for two",
    description:
      "A cross-platform expense tracker for couples and households that deliberately never touches your bank. Fast manual entry, recurring templates, and receipt capture feed a split engine that handles equal, exact, percentage, share, and proportional-by-income splits, with exact-to-the-cent settlement between people.",
    stack: ["React Native", "Expo", "TypeScript", "AWS CDK", "DynamoDB", "Lambda"],
    accent: "#4ade80",
  },
  {
    name: "Seatt",
    tagline: "Post a plan, leave one seat open",
    description:
      "A dating app where the unit of interaction is a concrete plan rather than a profile. You post something real and time-boxed, people request the seat, you pick one, the seat locks. A serverless backend runs the whole lifecycle: expiry sweeps, grace windows, and automated photo moderation.",
    stack: ["React Native", "Hono", "TypeScript", "DynamoDB", "Rekognition", "Stripe"],
    href: "https://seatt.app",
    icon: "/images/projects/seatt.png",
    accent: "#f472b6",
  },
  {
    name: "MedSentri",
    tagline: "Drug safety, aggregated and readable",
    description:
      "A medical information platform that pulls from the FDA, Health Canada, ClinicalTrials.gov, WHO, CDC, and RxNorm, then normalizes it into one searchable surface: trials, shortages, recalls, labels, adverse events, and approvals. Around fifty Lambda handlers behind a single API, with plain-language AI summaries on top.",
    stack: ["React", "TypeScript", "OpenSearch", "API Gateway", "Cognito", "Claude"],
    href: "https://medsentri.com",
    icon: "/images/projects/medsentri.png",
    accent: "#38bdf8",
  },
  {
    name: "DareUp",
    tagline: "Dares, on video",
    description:
      "A short-form video app built around completing and sharing dares, with a mobile client, an admin dashboard, and a marketing site all deployed from one repo. Every AWS resource behind it is defined in CDK, so the whole stack stands up from a single command.",
    stack: ["React Native", "Expo", "TypeScript", "AWS CDK", "Lambda", "Vite"],
    href: "https://dareup.app",
    icon: "/images/projects/dareup.png",
    accent: "#fbbf24",
  },
];

export type Experience = {
  role: string;
  org: string;
  period: string;
  bullets: string[];
};

export const experience: Experience[] = [
  {
    role: "Senior Software Development Engineer",
    org: "Amazon",
    period: "March 2021 – Present",
    bullets: [
      "Built a large-scale learning management system for Amazon associates, working directly with stakeholders to shape an application around their training and development needs.",
      "Designed an end-to-end data reporting solution for business intelligence on Spark, Kafka, ElasticSearch, Glue, and Kinesis, turning raw operational events into decision-ready insight.",
      "Delivered resilient, scalable services on Lambda, DynamoDB, S3, SNS, and Step Functions.",
      "Worked across TypeScript (Node.js), Java, and Python, with Angular for feature-rich web front ends.",
    ],
  },
  {
    role: "Machine Learning Engineer",
    org: "RBC",
    period: "May 2019 – August 2019",
    bullets: [
      "Developed analytics in Python, SQL, and JavaScript alongside the machine learning team, and optimized feature bucketing distribution algorithms over Big Data on a Hadoop cluster.",
      "Analyzed XGBoost and Random Forest performance using ROC curves, non-cumulative lifts, and confusion matrices.",
      "Implemented the LIME explainer for black-box model testing and automated the client look-up dashboards around it.",
    ],
  },
  {
    role: "Teaching Assistant",
    org: "University of Toronto",
    period: "September 2016 – December 2017",
    bullets: [
      "Guided first-year students through the transition from high school to university coursework.",
      "Tutored across mathematics and computer science subjects, keeping students on track through the term.",
    ],
  },
];

export const education = {
  school: "University of Toronto Scarborough",
  degree: "Honours Bachelor of Science, Mathematical and Computer Sciences",
  period: "September 2016 – April 2020",
};

export type SkillGroup = { label: string; items: string[] };

export const skills: SkillGroup[] = [
  {
    label: "Languages",
    items: ["TypeScript", "Java", "Python", "JavaScript", "C#", "SQL"],
  },
  {
    label: "Cloud",
    items: ["AWS CDK", "Lambda", "DynamoDB", "S3", "CloudFront", "Step Functions", "API Gateway", "Cognito"],
  },
  {
    label: "Data",
    items: ["Spark", "Kafka", "Kinesis", "Glue", "OpenSearch", "MongoDB", "MySQL"],
  },
  {
    label: "Client",
    items: ["React", "React Native", "Expo", "Angular", "Three.js", "Vite"],
  },
];
