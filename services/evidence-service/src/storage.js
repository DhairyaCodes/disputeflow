import { Storage } from '@google-cloud/storage';

export function createObjectStorage(bucketName, projectId, apiEndpoint) {
  const storage = new Storage({
    projectId,
    ...(apiEndpoint ? { apiEndpoint } : {})
  });
  const bucket = storage.bucket(bucketName);

  return {
    async ensureBucket() {
      const [exists] = await bucket.exists();
      if (!exists) await bucket.create();
    },
    async upload(objectName, buffer, contentType, metadata = {}) {
      await bucket.file(objectName).save(buffer, {
        contentType,
        resumable: false,
        metadata: { metadata }
      });
    },
    async remove(objectName) {
      await bucket.file(objectName).delete({ ignoreNotFound: true });
    }
  };
}
