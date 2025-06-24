export const BUCKET_RESTRICTIONS = [
  
  // Only users with permission to access the page that allows logo uploads
  // can upload files to the logo bucket
  {
    bucket: 'logo',
    productCode: '13', //UI resources
    resourceCode: 'MarketplaceNetwork', //Access the Marketplace Network
    errorMessage: 'User does not have access to upload logo files',
  }
]