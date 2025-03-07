# File Manager GraphQL

A GraphQL service for managing files in VTEX applications. This service provides a simple interface for uploading, retrieving, and deleting files with support for image resizing.

This API is a GraphQL abstraction of the [vtex.file-manager@0.x](https://github.com/vtex/file-manager) app, providing a unified interface for file management.
Usage

## Features

- File uploads with automatic UUID-based naming
- File retrieval with optional image resizing
- File URL generation for direct access
- File deletion
- Authentication requirements for sensitive operations
- Support for different storage buckets


## Usage
To use this API, declare it in your manifest.json file:

```JSON
"dependencies": {
  "file-manager-graphql": "0.x"
}
```

## Queries

### getFileUrl
Returns the immutable URL of a file.

| Arguments | Type | Description |
| --- | --- | --- |
| path | [String](#string) | File path |
| bucket | [String](#string) |  Bucket name |

### getFile

| Arguments | Type | Description |
| --- | --- | --- |
| path | [String](#string) | File path |
| bucket | [String](#string) |  Bucket name |
| width | [Int](#int) |  Image width |
| height | [Int](#int) |  Image height |
| aspect | [Boolean](#boolean) |  Maintain image aspect ratio |


### settings
Returns the API settings.

## Mutations

### uploadFile
Saves a file and returns its immutable URL.

| Arguments | Type | Description |
| --- | --- | --- |
| file | [File](#file) | File to be uploaded |
| bucket | [String](#string) |  Bucket name |



### deleteFile
Deletes a file from a bucket.

| Arguments | Type | Description |
| --- | --- | --- |
| path | [string](#string) | File path |
| bucket | [String](#string) |  Bucket name |


## Types

### File

| Field | Type | Description |
| --- | --- | --- |
| fileUrl | [String](#string) | File URL |
| mimetype | [String](#string) |  File MIME type |
| encoding | [String](#string) |  File encoding |

### Settings

| Field | Type | Description |
| --- | --- | --- |
| maxFileSizeMB | [Int](#int) | Maximum allowed file size (in MB) |


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

## Scalars

### Boolean

The `Boolean` scalar type represents `true` or `false`.

### Int

The `Int` scalar type represents non-fractional signed whole numeric values. Int can represent values between -(2^31) and 2^31 - 1.

### String

The `String` scalar type represents textual data, represented as UTF-8 character sequences. The String type is most often used by GraphQL to represent free-form human-readable text.

## Security

This service implements authentication directives to ensure that sensitive operations like file uploads and deletions are properly authorized.

## License

This project is licensed under the terms specified in the `package.json` file.