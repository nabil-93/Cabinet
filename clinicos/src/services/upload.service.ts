import api from "./api";

export interface UploadedDocument {
  id: string;
  fileName: string;
  originalFileName: string;
  fileType: string;
  fileSize: number;
  documentType: string;
  description?: string;
  uploadedAt: string;
}

export const uploadService = {
  async uploadDocument(
    patientId: string,
    file: File,
    documentType = "OTHER",
    description?: string
  ): Promise<UploadedDocument> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("documentType", documentType);
    if (description) formData.append("description", description);

    const res = await api.post<UploadedDocument>(
      `/documents/upload/${patientId}`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
    return res.data;
  },

  async getPatientDocuments(patientId: string): Promise<UploadedDocument[]> {
    const res = await api.get<UploadedDocument[]>(`/documents/patient/${patientId}`);
    return res.data;
  },
};
