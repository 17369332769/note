import type { Plugin } from "@/lib/plugins";

export type PolicyKind = "privacy" | "terms" | "refund";

export type PolicySection = {
  title: string;
  body: string[];
};

export type PolicyDocument = {
  title: string;
  eyebrow: string;
  summary: string;
  effectiveDate: string;
  sections: PolicySection[];
};

export const policyKinds: PolicyKind[] = ["privacy", "terms", "refund"];

export function getPolicyLabel(kind: PolicyKind) {
  if (kind === "privacy") return "Privacy Policy";
  if (kind === "terms") return "Terms of Service";
  return "Refund Policy";
}

export function getPolicyHref(slug: string, kind: PolicyKind) {
  return `/plugins/${slug}/${kind}` as `/plugins/${string}/${PolicyKind}`;
}

function getPluginDataSummary(plugin: Plugin) {
  if (plugin.slug === "image-markup") {
    return [
      "Selected Google Docs image metadata and image content needed to create an annotation session.",
      "Images uploaded directly to the editor, annotated PNGs, generated revisions, and edit brief JSON when you choose to save or generate outputs.",
      "Session identifiers and temporary tokens used to verify that an editor request belongs to the user who opened the add-on.",
      "Operational logs needed to diagnose errors, protect the service, and confirm that image generation requests completed.",
    ];
  }

  if (plugin.slug === "figma-image-markup") {
    return [
      "Selected Figma layer, frame, component, or image content exported as a PNG when you run the plugin.",
      "Uploaded source images, annotated PNGs, generated revisions, and edit brief JSON when you choose to save, export, or generate outputs.",
      "Basic source metadata such as selected layer name, dimensions, generated filename, and temporary object keys needed to open the editor.",
      "Operational logs needed to diagnose errors, protect the service, and confirm that image upload or generation requests completed.",
    ];
  }

  if (plugin.slug === "meeting-notes") {
    return [
      "Calendar event context that you choose to open with the add-on, such as title, timing, attendees, and meeting metadata.",
      "Documents created or updated for agendas, notes, minutes, and action items.",
      "Drive file identifiers for documents created by the add-on when needed to link Calendar and Docs workflows.",
      "Operational logs needed to diagnose errors, protect the service, and improve reliability.",
    ];
  }

  return [
    "Spreadsheet content from the active sheet or selected range when you run a cleanup action.",
    "Drive file identifiers for files created or updated by the add-on when the workflow needs export or save behavior.",
    "Action settings such as cleanup mode, selected range, and transformation options.",
    "Operational logs needed to diagnose errors, protect the service, and improve reliability.",
  ];
}

function getUseSummary(plugin: Plugin) {
  if (plugin.slug === "image-markup") {
    return "We use this data to load the selected image, display it in the editor, export annotated copies, generate clean AI revisions when requested, and insert outputs back into your Google Docs workflow.";
  }

  if (plugin.slug === "figma-image-markup") {
    return "We use this data to export the selected Figma content, load it in the Image Markup editor, export annotated copies, and generate clean AI revisions when requested.";
  }

  if (plugin.slug === "meeting-notes") {
    return "We use this data to create structured meeting documents, connect notes to the source calendar event, and help you manage agendas, minutes, and action items.";
  }

  return "We use this data to run cleanup actions, normalize spreadsheet content, provide feedback in the side panel, and prepare selected ranges for export or continued work.";
}

function getThirdPartySummary(plugin: Plugin) {
  if (plugin.slug === "image-markup") {
    return "Image Markup may send the original image, annotated image, and edit brief to RunningHub only when you choose to generate a clean revision. It may also store temporary image objects in Cloudflare R2 or equivalent private object storage for upload, download, and provider handoff.";
  }

  if (plugin.slug === "figma-image-markup") {
    return "Figma Image Markup may send the original exported image, annotated image, and edit brief to RunningHub only when you choose to generate a clean revision. It may also store temporary image objects in Cloudflare R2 or equivalent private object storage for upload, download, and provider handoff.";
  }

  return `${plugin.name} does not sell user data and should only share data with third-party services when the operator explicitly adds integrations required for the workflow.`;
}

function getPlatformPolicySummary(plugin: Plugin) {
  if (plugin.slug === "figma-image-markup") {
    return [
      "Figma file content is accessed through Figma plugin APIs only when you run the plugin and choose a selection to export.",
      "Selected content is used only to provide the user-facing export, annotation, revision, and download workflow.",
      "Human access to user data is limited to cases where the user asks for support, where access is required for security or abuse investigation, or where required by law.",
    ];
  }

  return [
    "Use and transfer of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements.",
    "Google Workspace data is used only to provide or improve user-facing features that are visible in the plugin workflow.",
    "Human access to user data is limited to cases where the user asks for support, where access is required for security or abuse investigation, or where required by law.",
  ];
}

function buildPrivacyPolicy(plugin: Plugin): PolicyDocument {
  return {
    title: `${plugin.name} Privacy Policy`,
    eyebrow: "Privacy Policy",
    summary:
      "This policy explains what product data this plugin accesses, how that data is used, and how platform data is limited to the visible plugin workflow.",
    effectiveDate: "2026-07-06",
    sections: [
      {
        title: "Information We Access",
        body: getPluginDataSummary(plugin),
      },
      {
        title: "How We Use Information",
        body: [
          getUseSummary(plugin),
          "We do not use Google Workspace user data for advertising, user profiling, or unrelated product analytics.",
        ],
      },
      {
        title: plugin.slug === "figma-image-markup" ? "Figma Plugin Data Use" : "Google API Services and Limited Use",
        body: getPlatformPolicySummary(plugin),
      },
      {
        title: "Data Sharing and Third-Party Processing",
        body: [
          getThirdPartySummary(plugin),
          "We do not sell user data. We do not transfer Google Workspace user data to third parties except as needed to provide the requested plugin functionality, comply with law, or protect the service.",
        ],
      },
      {
        title: "Retention and Deletion",
        body: [
          plugin.slug === "figma-image-markup"
            ? "Exported Figma content is kept only as long as needed for the active workflow, configured storage, troubleshooting, or legal obligations. Temporary image objects are normally deleted or expired within 30 days unless a user or administrator configures a shorter retention period."
            : "Workspace content is kept only as long as needed for the active workflow, configured storage, troubleshooting, or legal obligations. Temporary image objects are normally deleted or expired within 30 days unless a user or administrator configures a shorter retention period.",
          "Operational logs used for security and reliability are normally retained for up to 90 days, unless a longer period is required to investigate abuse, security incidents, service errors, or legal obligations.",
          plugin.slug === "figma-image-markup"
            ? "If the plugin is deployed by your organization, deletion timing may depend on that organization's Figma, plugin distribution, and storage configuration."
            : "If the plugin is deployed by your organization, deletion timing may depend on that organization's Google Workspace, Apps Script, Drive, and storage configuration.",
          plugin.slug === "figma-image-markup"
            ? "To request deletion of data controlled by the plugin operator, contact a17369332769@gmail.com and include the Figma account or team context, selected file context, and approximate time of the workflow when possible."
            : "To request deletion of data controlled by the plugin operator, contact a17369332769@gmail.com and include the Google account, document context, and approximate time of the workflow when possible.",
        ],
      },
      {
        title: "Security",
        body: [
          plugin.slug === "figma-image-markup"
            ? "The plugin uses Figma plugin permissions and explicit user actions to limit access to the selected content needed for the requested workflow."
            : "The plugin uses Google Workspace authorization scopes and Apps Script controls to limit access to the data needed for the requested workflow.",
          plugin.slug === "figma-image-markup"
            ? "Server-side API keys and provider credentials should be stored in secure deployment environment variables, not in Figma plugin UI code."
            : "Server-side API keys and provider credentials should be stored in secure deployment environment variables, not in browser code or Apps Script files.",
        ],
      },
      {
        title: "Changes",
        body: [
          "We may update this policy when plugin capabilities, Google Workspace scopes, storage, or third-party processors change.",
          "The effective date above indicates the latest published version of this policy.",
        ],
      },
    ],
  };
}

function buildTermsPolicy(plugin: Plugin): PolicyDocument {
  return {
    title: `${plugin.name} Terms of Service`,
    eyebrow: "Terms of Service",
    summary:
      "These terms describe the rules for using this Google Workspace plugin, including acceptable use, account responsibility, service limitations, and disclaimers.",
    effectiveDate: "2026-07-06",
    sections: [
      {
        title: "Acceptance of Terms",
        body: [
          `By installing, accessing, or using ${plugin.name}, you agree to these Terms of Service and any policies referenced from the plugin listing or deployment page.`,
          "If you use the plugin on behalf of an organization, you represent that you have authority to accept these terms for that organization.",
        ],
      },
      {
        title: "Service Description",
        body: [
          `${plugin.name} is a Google Workspace add-on for ${plugin.audience}`,
          "The plugin may include Apps Script code, a Next.js web experience, and optional external services depending on how it is deployed.",
        ],
      },
      {
        title: "User Responsibilities",
        body: [
          "You are responsible for the content you open, upload, process, generate, export, or insert using the plugin.",
          "Do not use the plugin to process content you do not have permission to access, content that violates law, or content that infringes third-party rights.",
          "Administrators are responsible for configuring Workspace scopes, deployment settings, storage providers, API keys, and access controls before publishing the plugin to users.",
        ],
      },
      {
        title: "Google Workspace Access",
        body: [
          plugin.slug === "figma-image-markup"
            ? "The plugin can access Figma document content only through Figma plugin APIs and only while the plugin is running in a file where you use it."
            : "The plugin can access Google Workspace data only after the required Google authorization flow and only within the scopes configured for the deployment.",
          plugin.slug === "figma-image-markup"
            ? "Removing the development plugin or published Figma plugin prevents it from exporting future selections."
            : "Revoking the plugin's Google access or uninstalling the add-on may prevent some features from working.",
        ],
      },
      {
        title: "Availability and Changes",
        body: [
          "The plugin is provided on an as-is and as-available basis. Features may change as the plugin, Google Workspace APIs, Apps Script, or third-party services change.",
          "We may suspend or limit access to protect the service, comply with law, resolve abuse, or perform maintenance.",
        ],
      },
      {
        title: "Disclaimers and Limitation of Liability",
        body: [
          "The plugin does not guarantee that generated, transformed, exported, or inserted content will be error-free, complete, or suitable for every use case.",
          "To the maximum extent permitted by law, liability is limited to the amount paid for the plugin during the period giving rise to the claim.",
        ],
      },
      {
        title: "Contact",
        body: [
          "For support, legal, privacy, or billing questions, contact a17369332769@gmail.com.",
        ],
      },
    ],
  };
}

function buildRefundPolicy(plugin: Plugin): PolicyDocument {
  return {
    title: `${plugin.name} Refund Policy`,
    eyebrow: "Refund Policy",
    summary:
      "This policy explains how refunds are handled if a paid version, subscription, or marketplace listing is attached to this plugin.",
    effectiveDate: "2026-07-06",
    sections: [
      {
        title: "Free Access",
        body: [
          `${plugin.name} is currently distributed for free. No purchase is charged and no refund is required for free access.`,
          "If a future paid plan or marketplace purchase is offered, the refund terms below apply unless the listing states a more specific policy.",
        ],
      },
      {
        title: "Refund Window",
        body: [
          "You may request a refund within 3 days of the initial purchase or subscription charge when the product does not work as described or cannot be reasonably used after support troubleshooting.",
          "Renewals, partial billing periods, and one-time setup services are generally not refundable unless required by law or stated otherwise in the purchase flow.",
        ],
      },
      {
        title: "How to Request a Refund",
        body: [
          "Send the purchase account, order identifier, plugin name, billing date, and a short description of the issue to a17369332769@gmail.com.",
          "We may ask for diagnostic details needed to verify the issue, such as Workspace host, browser, deployment configuration, or error messages.",
        ],
      },
      {
        title: "Refund Processing",
        body: [
          "Approved refunds are returned to the original payment method where possible. Processing time depends on the payment provider and marketplace.",
          "When a refund is issued, paid access may be downgraded, disabled, or removed.",
        ],
      },
      {
        title: "Non-Refundable Cases",
        body: [
          "Refunds may be denied for misuse, policy violations, expired refund windows, unsupported custom deployments, or issues caused by third-party services outside the plugin operator's control.",
          "Nothing in this policy limits consumer rights that cannot be waived under applicable law.",
        ],
      },
    ],
  };
}

export function getPolicyDocument(plugin: Plugin, kind: PolicyKind): PolicyDocument {
  if (kind === "privacy") return buildPrivacyPolicy(plugin);
  if (kind === "terms") return buildTermsPolicy(plugin);
  return buildRefundPolicy(plugin);
}

export function isPolicyKind(value: string): value is PolicyKind {
  return policyKinds.includes(value as PolicyKind);
}
