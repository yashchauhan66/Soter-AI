import { REGION, TABLE_NAME } from "./dynamodb-events-common";

const accountId = process.env.AWS_ACCOUNT_ID || "<ACCOUNT_ID>";
const tableArn = `arn:aws:dynamodb:${REGION}:${accountId}:table/${TABLE_NAME}`;

console.log(JSON.stringify({
  Version: "2012-10-17",
  Statement: [
    {
      Sid: "SoterAiEventsTableReadWrite",
      Effect: "Allow",
      Action: [
        "dynamodb:PutItem",
        "dynamodb:BatchWriteItem",
        "dynamodb:GetItem",
        "dynamodb:Query",
        "dynamodb:DescribeTable",
      ],
      Resource: [
        tableArn,
        `${tableArn}/index/*`,
      ],
    },
  ],
}, null, 2));

