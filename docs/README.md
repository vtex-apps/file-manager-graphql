# File Manager GraphQL

This API is a GraphQL abstraction of the vtex.file-manager@0.x app, providing a unified interface for file management.
Usage

### Usage
To use this API, declare it in your manifest.json file:

```JSON
"dependencies": {
  "file-manager-graphql": "0.x"
}
```

### Queries

getFileUrl
Returns the immutable URL of a file.
Arguments:
path: File path
bucket: Bucket name
Return: String
getFile
Returns a file.
Arguments:
path: File path
width: Image width
height: Image height
aspect: Maintain image aspect ratio
bucket: Bucket name
Return: String
settings
Returns the API settings.
Return: Settings

### Mutations

uploadFile
Saves a file and returns its immutable URL.
Arguments:
file: File to be uploaded
bucket: Bucket name
Return: File
deleteFile
Deletes a file from a bucket.
Arguments:
path: File path
bucket: Bucket name
Return: Boolean

## Types

### File

| Field | Argument | Type | Description |
| --- | --- | --- | --- |
| fileUrl | [String](#string) |  | File URL |
| mimetype | [String](#string) |  | File MIME type |
| encoding | [String](#string) |  | File encoding |

### Settings

| Field | Argument | Type | Description |
| --- | --- | --- | --- |
| maxFileSizeMB | [Int](#int) |  | Maximum allowed file size (in MB) |


### Examples

Getting a file URL

```graphql
query {
  getFileUrl(path: "path/to/file", bucket: "images") {
    fileUrl
  }
}
```

Getting a file

```graphql
query {
  getFile(path: "path/to/file", width: 100, height: 100, bucket: "images") {
    file
  }
}
```

Uploading a file

```graphql

mutation {
  uploadFile(file: ..., bucket: "images") {
    fileUrl
  }
}
```