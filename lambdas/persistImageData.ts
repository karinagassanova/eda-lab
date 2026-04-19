import { SQSHandler } from "aws-lambda";

import {
  GetObjectCommand,
  GetObjectCommandInput,
  S3Client,
} from "@aws-sdk/client-s3";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const s3 = new S3Client();
const ddbDocClient = createDDbDocClient();

export const handler: SQSHandler = async (event) => {
  console.log("Event ", JSON.stringify(event));

  for (const record of event.Records) {
    const recordBody = JSON.parse(record.body);
    const snsMessage = JSON.parse(recordBody.Message);

    if (snsMessage.Records) {
      for (const s3Message of snsMessage.Records) {
        const s3e = s3Message.s3;
        const srcBucket = s3e.bucket.name;

        const srcKey = decodeURIComponent(
          s3e.object.key.replace(/\+/g, " ")
        );

        let theImage = null;

        try {
          const params: GetObjectCommandInput = {
            Bucket: srcBucket,
            Key: srcKey,
          };

          theImage = await s3.send(
            new GetObjectCommand(params)
          );

          const typeMatch = srcKey.match(/\.([^.]*)$/);

          if (!typeMatch) {
            console.log(
              "Could not determine the image type."
            );
            throw new Error(
              "Could not determine the image type."
            );
          }

          const imageType = typeMatch[1].toLowerCase();

          if (
            imageType != "jpeg" &&
            imageType != "png"
          ) {
            throw new Error(
              `Unsupported image type: ${imageType}.`
            );
          }

          await ddbDocClient.send(
            new PutCommand({
              TableName: process.env.TABLE_NAME,
              Item: {
                name: srcKey,
              },
            })
          );
        } catch (error) {
          console.log(error);
          throw error;
        }
      }
    }
  }
};

function createDDbDocClient() {
  const ddbClient = new DynamoDBClient({
    region: process.env.REGION,
  });

  const marshallOptions = {
    convertEmptyValues: true,
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  };

  const unmarshallOptions = {
    wrapNumbers: false,
  };

  const translateConfig = {
    marshallOptions,
    unmarshallOptions,
  };

  return DynamoDBDocumentClient.from(
    ddbClient,
    translateConfig
  );
}