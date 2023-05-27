# Problems when uploading large (> 50 GiB) Git LFS objects to GitLab instances

## 1. GitLab Workhorse cannot upload files larger than 50 GiB to temporary S3 location

Fix: Make Workhorse use presigned URLs instead of AWS S3 SDK (maximum size will
then be 100 parts at 5 GiB each = 500 GiB) and use a higher timeout for the
presigned URLs as the Git LFS client might need more than 4 hours (default
timeout) to upload the Git LFS object:

```shell
file="/opt/gitlab/embedded/service/gitlab-rails/lib/object_storage/direct_upload.rb"
script='/def use_workhorse_s3_client\?/a return false'
sed -E -i.orig -- "$script" "$file" && ! diff -u -- "$file.orig" "$file"

file="/opt/gitlab/embedded/service/gitlab-rails/lib/object_storage/direct_upload.rb"
script='s/TIMEOUT = 4\.hours/TIMEOUT = 48.hours/'
sed -E -i.orig -- "$script" "$file" && ! diff -u -- "$file.orig" "$file"
```

(Alternative fix: patch Workhorse to use larger part size with AWS S3 SDK, see
`patch-gitlab-lfs-s3`.)

## 2. GitLab Rails request times out while copying Git LFS object from temporary S3 location to final S3 location

Fix: Configure higher timeout in `/etc/gitlab/gitlab.rb` (or
`GITLAB_OMNIBUS_CONFIG` environment variable) (default: 60 s):

```ruby
gitlab_rails['env'] = {
   'GITLAB_RAILS_RACK_TIMEOUT' => 600
}

# https://gitlab.com/gitlab-org/gitlab/-/issues/373743
postgresql['idle_in_transaction_session_timeout'] = "360000"
```

## 3. Local Git LFS client times out while waiting for GitLab Rails response after uploading object

Fix: Disable local Git LFS client timeout (default: 30 s):

```shell
git config lfs.activitytimeout 0

# or globally (for user):
# git config --global lfs.activitytimeout 0
```

## 4. Optional: speed up response by GitLab Rails

Use larger part size when copying from temporary S3 location to final S3
location (response may still take more than 30 s or 60 s, so the other fixes are
still necessary):

```shell
file="/opt/gitlab/embedded/service/gitlab-rails/config/initializers/carrierwave_patch.rb"
script='s/file\.multipart_chunk_size = 10485760$/file.multipart_chunk_size = 10485760 \/ 10 * 1024 # 1 GiB/'
sed -E -i.orig -- "$script" "$file" && ! diff -u -- "$file.orig" "$file"
```
