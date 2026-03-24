import { SQSHandler } from "aws-lambda";
import {
  SESClient,
  SendEmailCommand,
  SendEmailCommandInput,
} from "@aws-sdk/client-ses";

// Environment variables from Lambda configuration
const SES_EMAIL_FROM = process.env.SES_EMAIL_FROM!;
const SES_EMAIL_TO = process.env.SES_EMAIL_TO!;
const SES_REGION = process.env.SES_REGION!;

// Log the environment variables for debug
console.log("FROM:", SES_EMAIL_FROM, "TO:", SES_EMAIL_TO, "REGION:", SES_REGION);

if (!SES_EMAIL_TO || !SES_EMAIL_FROM || !SES_REGION) {
  throw new Error(
    "Please set SES_EMAIL_TO, SES_EMAIL_FROM, and SES_REGION environment variables in the Lambda configuration."
  );
}

type ContactDetails = {
  name: string;
  email: string;
  message: string;
};

const client = new SESClient({ region: SES_REGION });

export const handler: SQSHandler = async (event: any) => {
  console.log("Event received:", JSON.stringify(event));

  for (const record of event.Records) {
    const recordBody = JSON.parse(record.body);
    const snsMessage = JSON.parse(recordBody.Message);

    if (snsMessage.Records) {
      console.log("SNS Records:", JSON.stringify(snsMessage.Records));

      for (const s3Message of snsMessage.Records) {
        const s3e = s3Message.s3;
        const srcBucket = s3e.bucket.name;
        const srcKey = decodeURIComponent(s3e.object.key.replace(/\+/g, " "));

        try {
          const emailDetails: ContactDetails = {
            name: "The Photo Album",
            email: SES_EMAIL_FROM,
            message: `We received your image. Its URL is s3://${srcBucket}/${srcKey}`,
          };

          const params = sendEmailParams(emailDetails);
          await client.send(new SendEmailCommand(params));
          console.log("Email sent successfully to", SES_EMAIL_TO);
        } catch (error: unknown) {
          console.error("ERROR sending email:", error);
        }
      }
    }
  }
};

// Helper function to generate SES parameters
function sendEmailParams({ name, email, message }: ContactDetails) {
  const parameters: SendEmailCommandInput = {
    Destination: { ToAddresses: [SES_EMAIL_TO] },
    Message: {
      Body: {
        Html: {
          Charset: "UTF-8",
          Data: getHtmlContent({ name, email, message }),
        },
      },
      Subject: {
        Charset: "UTF-8",
        Data: "New Image Upload",
      },
    },
    Source: SES_EMAIL_FROM,
  };
  return parameters;
}

// HTML email content
function getHtmlContent({ name, email, message }: ContactDetails) {
  return `
    <html>
      <body>
        <h2>Sent from:</h2>
        <ul>
          <li style="font-size:18px">👤 <b>${name}</b></li>
          <li style="font-size:18px">✉️ <b>${email}</b></li>
        </ul>
        <p style="font-size:18px">${message}</p>
      </body>
    </html>
  `;
}