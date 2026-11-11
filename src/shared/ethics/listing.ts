/**
 * Legacy checkDeleteEthicsConditions (ethics-start-page.js): the administrator view deletes an individual draft, or a
 * collaborative one in draft or in progress with a draft response; the respondent view deletes a collaborative draft.
 */
export function canDeleteEthics(
  access: string,
  typeCode: string,
  statusCode: string,
  responseStatusCode: string,
) {
  if (access === "EA_ACCESS") {
    if (typeCode === "INDIVIDUAL") return statusCode === "DRFT";
    if (typeCode === "COLLAB")
      return (
        statusCode === "DRFT" ||
        (statusCode === "WIP" && responseStatusCode === "DRFT")
      );
    return false;
  }
  if (access === "RESPONDENT_ACCESS")
    return typeCode === "COLLAB" && statusCode === "DRFT";
  return false;
}
