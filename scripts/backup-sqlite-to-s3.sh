#!/bin/bash
rm -rf backups
mkdir backups

for fn in $( find $SQLITE_DATA_PATH -name '*.sqlite3' ); do
  echo $fn;
  sqlite3 $fn "VACUUM INTO 'backups/$(basename $fn)'"
done

tar -zcf backups.tar.gz backups

AWS_ACCESS_KEY_ID=$BACKUP_S3_KEY_ID \
  AWS_SECRET_ACCESS_KEY=$BACKUP_S3_SECRET \
  AWS_ENDPOINT_URL=https://$BACKUP_S3_ENDPOINT \
  ./aws/dist/aws s3 cp backups.tar.gz s3://$BACKUP_S3_BUCKET_NAME/$BACKUP_S3_PREFIX-backups-`date +%Y%m%d-%H`.tar.gz

rm -rf backups backups.tar.gz
