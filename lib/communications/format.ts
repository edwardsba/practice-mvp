export function formatCommunicationTemplateType(templateType: string) {
  if (templateType === "send_assessment") return "Send Assessment"
  if (templateType === "ad_hoc") return "Ad hoc"
  return templateType
}

export function formatCommunicationStatus(status: string) {
  if (status === "sent") return "Sent"
  if (status === "failed") return "Failed"
  return status
}
