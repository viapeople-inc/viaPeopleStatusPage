// Bundled with the same collector and evaluator used by the static publisher.
const {S3Client, GetObjectCommand, PutObjectCommand} = require('@aws-sdk/client-s3');
const s3 = new S3Client({});
exports.handler = async () => {
  const settings = configure({...PUBLIC_CONFIG, staleAfterSeconds:180});
  let previous = {};
  try {
    const object = await s3.send(new GetObjectCommand({Bucket:process.env.STATUS_BUCKET,Key:'status.json'}));
    previous = JSON.parse(await object.Body.transformToString());
  } catch (error) {
    if (error.name !== 'NoSuchKey') throw Error('Status state unavailable');
  }
  // A retry or duplicate schedule must not count as a second recovery sample.
  const elapsed = Date.now() - Date.parse(previous.generatedAt);
  if (elapsed >= 0 && elapsed < 45000) return {skipped:true};
  const snapshot = await collect(settings,previous);
  await s3.send(new PutObjectCommand({Bucket:process.env.STATUS_BUCKET,Key:'status.json',Body:JSON.stringify(snapshot),ContentType:'application/json',CacheControl:'no-store'}));
  console.log(JSON.stringify({event:'status_collected',generatedAt:snapshot.generatedAt,status:snapshot.status}));
  return {generatedAt:snapshot.generatedAt,status:snapshot.status};
};
