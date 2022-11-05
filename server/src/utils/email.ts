import Mailgun from "mailgun.js";
import path from "path";
import formData from "form-data";
import fs from "fs";

export const ADMIN_NEW_ORDER = "admin-new-order";
export const CUSTOMER_NEW_ORDER = "customer-new-order";
export const FORGOT_PASSWORD = "forgot-password";
export const CONTACT_MESSAGE = "contact-message";

type EmailTemplateVariables = Record<string, string | Record<string, string>[]>;
interface EmailTemplate {
  subject: string;
  template: string;
  partials: Record<string, string>;
  variables: EmailTemplateVariables;
}

const EMAIL_TEMPLATES: Record<string, EmailTemplate> = {
  [CONTACT_MESSAGE]: {
    subject: "New message from your contact form",
    template: CONTACT_MESSAGE,
    partials: {},
    variables: { email: "", message: "" },
  },
  [FORGOT_PASSWORD]: {
    subject: "Forgot Password",
    template: FORGOT_PASSWORD,
    partials: {
      actionButton: "action-button",
    },
    variables: {
      actionText: "",
      actionLink: "",
      email: "",
    },
  },
  [ADMIN_NEW_ORDER]: {
    subject: "A new order has been placed!",
    template: ADMIN_NEW_ORDER,
    partials: { productList: "product-info" },
    variables: {
      email: "",
      orderId: "",
      stripePaymentUrl: "",
      address: "",
      productList: [
        {
          imageUrl: "",
          id: "",
          title: "",
          cost: "",
          quantity: "",
        },
      ],
      totalCost: "",
    },
  },
  [CUSTOMER_NEW_ORDER]: {
    subject: "Thank you for your order!",
    template: CUSTOMER_NEW_ORDER,
    partials: { productList: "product-info" },
    variables: {
      orderId: "",
      address: "",
      productList: [
        {
          imageUrl: "",
          id: "",
          title: "",
          cost: "",
          quantity: "",
        },
      ],
      totalCost: "",
    },
  },
};

export const parseEmail = <Variables extends EmailTemplateVariables>(
  template: keyof typeof EMAIL_TEMPLATES,
  variables: Variables
) => {
  const html = fs
    .readFileSync(path.join("emails", template + ".html"))
    ?.toString();
  if (!html) return "";

  const parsedHtml = Object.keys(variables).reduce((currentHtml, key) => {
    let value = variables[key];

    if (typeof value !== "string") {
      const partial = fs
        .readFileSync(
          path.join(
            "emails",
            "partials",
            EMAIL_TEMPLATES[template].partials[key] + ".html"
          )
        )
        ?.toString();
      if (!partial) return currentHtml;

      value = value.reduce((current, vars) => {
        return (
          current +
          Object.keys(vars).reduce((curr, k) => {
            return curr.replace("{{" + k + "}}", vars[k]);
          }, partial)
        );
      }, "");
    }

    return currentHtml.replace("{{" + key + "}}", value);
  }, html);

  return parsedHtml;
};

export const sendEmail = async <Variables extends EmailTemplateVariables>(
  template: keyof typeof EMAIL_TEMPLATES,
  variables: Variables,
  recipient = process.env.ADMIN_EMAIL
) => {
  const mailer = new Mailgun(formData).client({
    username: "api",
    key: process.env.MAILGUN_SECRET_KEY as string,
  });
  const from = "Midwest Daisy <info@midwestdaisy.com>";
  const to = recipient;
  const subject = EMAIL_TEMPLATES[template].subject;
  const html = parseEmail(EMAIL_TEMPLATES[template].template, variables);

  const sendResult = await mailer.messages.create(
    process.env.MAILGUN_DOMAIN as string,
    {
      from,
      to,
      subject,
      html,
    }
  );

  return sendResult;
};
