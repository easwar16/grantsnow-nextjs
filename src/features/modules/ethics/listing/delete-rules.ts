/** Source ethics-start-page.js#checkDeleteEthicsConditions. Missing codes never grant Delete. */
export function canDeleteEthicsRow(access: string, type: string, status: string, response: string) {
  if (access === "EA_ACCESS")
    return type === "INDIVIDUAL"
      ? status === "DRFT"
      : type === "COLLAB" && (status === "DRFT" || (status === "WIP" && response === "DRFT"));
  return access === "RESPONDENT_ACCESS" && type === "COLLAB" && status === "DRFT";
}
