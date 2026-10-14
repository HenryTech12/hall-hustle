import { apiClient } from "./client";

export const uploadsApi = {
  uploadListingMedia: (listingId, file) => {
    const formData = new FormData();
    formData.append("file", file);
    // Deliberately no explicit Content-Type header here — letting the
    // browser/axios set it automatically is required so it can include the
    // multipart boundary. Setting "multipart/form-data" manually (without
    // a boundary) silently breaks the upload and caused photos to never
    // actually attach to listings.
    return apiClient.post(`/uploads/listing-media/${listingId}`, formData).then((r) => r.data);
  },

  uploadListingMusic: (listingId, file) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient.post(`/uploads/listing-music/${listingId}`, formData).then((r) => r.data);
  },
};
