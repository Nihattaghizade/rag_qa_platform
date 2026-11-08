self.onmessage = async (event) => {
  const { jobId, file, apiBaseUrl, token } = event.data;

  try {
    self.postMessage({ jobId, status: "HASHING", progress: 5 });

    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const contentSha256 = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    self.postMessage({ jobId, status: "UPLOADING", progress: 10, sha256: contentSha256 });

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${apiBaseUrl}/files/upload/direct`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(errText || `Upload failed with status ${response.status}`);
    }

    const record = await response.json();
    self.postMessage({
      jobId,
      status: record.status || "UPLOADED",
      progress: record.progress_pct || 15,
      fileRecord: record,
    });
  } catch (err) {
    self.postMessage({
      jobId,
      status: "FAILED",
      progress: 0,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};