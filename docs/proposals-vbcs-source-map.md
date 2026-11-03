# VBCS Proposal source map

Verified from read-only `origin/development` in `/Users/easwar/Developer/GrantsNow` on 2026-10-29. This is a static source inventory. Dynamic calls or chains assembled at runtime require page-by-page review. The source is not modified.

26 HTML pages are present under the Proposal flow. Each entry lists the page-local chains and literal REST endpoints referenced by those chains.

## proposals-allocation-for-credit-start-page

- Template: `webApps/app/flows/proposals/flows/proposals-allocation-for-credit/pages/proposals-allocation-for-credit-start-page.html`
- Page model: `webApps/app/flows/proposals/flows/proposals-allocation-for-credit/pages/proposals-allocation-for-credit-start-page.json`
- Page helper: `webApps/app/flows/proposals/flows/proposals-allocation-for-credit/pages/proposals-allocation-for-credit-start-page.js`
- Page-local chains: **14**
- Literal REST endpoints: `apps/getCreditAllocation`, `apps/postProposalCreditAllocation`, `getCreditAllocation`, `getProposalProposal_id`
- Literal navigation page targets: none found in local chains
- Chain files: `ResetButtonActionChain.json`, `SaveButtonActionChain.json`, `TableBeforeRowEditChain.json`, `TableBeforeRowEditEndChain.json`, `creditPCTValueChangeChain.json`, `editRowButtonActionChain.json`, `exitActionChain.json`, `fetchCreditAllocations.json`, `fetchLockDataChain.json`, `fetchProposalDataChain.json`, `initialize.json`, `prjPCTValueChangeChain.json`, `saveRowButtonActionChain.json`, `userResponseActionChain.json`

## proposals-approvals-start-page

- Template: `webApps/app/flows/proposals/flows/proposals-approvals/pages/proposals-approvals-start-page.html`
- Page model: `webApps/app/flows/proposals/flows/proposals-approvals/pages/proposals-approvals-start-page.json`
- Page helper: `webApps/app/flows/proposals/flows/proposals-approvals/pages/proposals-approvals-start-page.js`
- Page-local chains: **5**
- Literal REST endpoints: `getProposalProposal_id`
- Literal navigation page targets: none found in local chains
- Chain files: `RefreshAfterApprovalChain.js`, `beforeExitHandler.json`, `fetchLockDataChain.json`, `fetchProposalDataActionChain.json`, `initialize.js`

## proposals-attachments-start-page

- Template: `webApps/app/flows/proposals/flows/proposals-attachments/pages/proposals-attachments-start-page.html`
- Page model: `webApps/app/flows/proposals/flows/proposals-attachments/pages/proposals-attachments-start-page.json`
- Page helper: `webApps/app/flows/proposals/flows/proposals-attachments/pages/proposals-attachments-start-page.js`
- Page-local chains: **23**
- Literal REST endpoints: `apps/deletePre_awardAttachmentsId`, `apps/getPre_awardAttachmentsProposal_id`, `apps/getPre_awardLinks`, `apps/postPre_awardAttachments`, `getPre_awardAttachmentsProposal_id`, `getProposalProposal_id`, `ics/deleteDELETE_OBJECT1_0Objectstorage`, `ics/getGET_OBJECT1_0Objectstorage`, `ics/putUPLOAD_OBJECT1_0Objectstorage`, `postPre_awardAttachments`
- Literal navigation page targets: none found in local chains
- Chain files: `CancelButtonActionChain.json`, `DialogCloseChain.json`, `FilePickerSelectChain.json`, `FolderViewSelectedChangeChain.json`, `MessagesBannerSpCloseChain.json`, `TreeViewDblclickChain.js`, `actionsMenuActionChain.json`, `addAttachmentButtonActionChain.json`, `addAttachmentLink.js`, `beforeExitHandlerChain.json`, `cancelLinkUpdate.js`, `closeDeleteWarning.js`, `deleteLinkAC.js`, `fetchAttachmentsDataChain.json`, `fetchProposalDataChain.json`, `initialize.json`, `insertAttachmentActionChain.json`, `openUpdateLinkDialog.js`, `toggleAddLink.js`, `updateLinkAC.js`, `updateLinkCloseAC.js`, `uploadDocumentToObjStorageActionChain.json`, `userResponseActionChain.json`

## proposals-awards-start-page

- Template: `webApps/app/flows/proposals/flows/proposals-awards/pages/proposals-awards-start-page.html`
- Page model: `webApps/app/flows/proposals/flows/proposals-awards/pages/proposals-awards-start-page.json`
- Page helper: `webApps/app/flows/proposals/flows/proposals-awards/pages/proposals-awards-start-page.js`
- Page-local chains: **79**
- Literal REST endpoints: `apps/deletePre_awardAttachmentsId`, `apps/getPost_awardsAwardDetails`, `apps/getPost_awardsAwardHeader`, `apps/getPost_awardsAwardhierarchy`, `apps/getPre_awardAttachmentsProposal_id`, `apps/getProposalGetSubProposalLists`, `apps/getSharedCustErpDetails2`, `apps/postPost_awardsAwardBudgetPeriods`, `apps/postPost_awardsAwardHeader`, `apps/postPost_awardsAwardPRJTeamMembers`, `apps/postPost_awardsAwardPrjCostItem`, `apps/postPost_awardsAwardProjects`, `apps/postPost_awardsGenerateAward`, `apps/postPre_awardAttachments`, `apps/postProposalCreditAllocation`, `apps/postProposalExtensionProposal`, `getPost_awardsAwardDetails`, `getPost_awardsAwardHeader`, `getPost_awardsAwardhierarchy`, `getPost_awardsGetProjectrole`, `getPre_awardAttachmentsProposal_id`, `getPre_awardGetLkpOrgUnitType`, `getPre_awardGetLookupTypesCodes`, `getPre_awardGetPersonList`, `getPre_awardGetcostcategoryitem`, `getPre_awards_costingGetSponsorParties`, `getProposalGetSubProposalLists`, `getProposalProposal_id`, `ics/deleteDELETE_OBJECT1_0Objectstorage`, `ics/getGET_OBJECT1_0Objectstorage`, `ics/getIcApiIntegrationV1FlowsRestUNIT4_MAIN_FLOW1_0Unit4integration`, `ics/postFP_GRANT_TO_ERP_AWARD_V2_2_0GrantsToERP`, `ics/putUPLOAD_OBJECT1_0Objectstorage`, `postPost_awardsAwardBudgetPeriods`, `postPre_awardAttachments`, `postProposalExtensionProposal`
- Literal navigation page targets: `/shell/awards/awards-detail`, `/shell/proposals/proposals-info-start/proposals-summary/proposals-summary-start`
- Chain files: `AddAttachmentButtonActionChain.json`, `AdditionalAwardPINameSelectValueItemChangeChain.json`, `AssignCostLineEditRowButtonActionChain.json`, `AssignProjectEditRowActionChain.json`, `AssignTeamEditRowButtonActionChain.json`, `AwardTreeFirstSelectedRowChangeChain.json`, `BudgetPeriodSaveButtonActionChain.json`, `CancelAddAttachmentdialogButtonActionChain.json`, `CancelDialogBudgetButtonActionChain.json`, `CancelDialogProjectCostLineButtonActionChain.json`, `CancelDialogProjectsButtonActionChain.json`, `CloseCreditDialogButtonActionChain.json`, `CloseDialogAwardDetailsButtonActionChain.json`, `CloseDialogTeamEditButtonActionChain.json`, `CostLineTableBeforeRowEditChain.json`, `CostLineTableBeforeRowEditEndChain.json`, `CreateAdditionalAwardButtonActionChain.json`, `DeleteAttachmentsButtonActionChain.json`, `EditBudgetButtonActionChain.json`, `EditProjectButtonActionChain.json`, `FetchFlattenedTreeDataProvider.json`, `FetchLOVDatas.js`, `FilePickerSelectChain.json`, `GenerateAwardButtonActionChain.json`, `GetAwardDetails.json`, `ListViewSelectedChangeChain.js`, `OpenAddAttachmentDialogButtonActionChain.json`, `OpenAddCreditDialogButtonActionChain.json`, `OpenBudgetPeriodsDialogActionChain.json`, `OpenDialogAdditionalAwardDetailsButtonActionChain.json`, `OpenDialogAwardCostLineButtonActionChain.json`, `OpenDialogAwardProjectButtonActionChain.json`, `OpenEditCreditDialogButtonActionChain.json`, `OpenExtendProposalButtonActionChain.js`, `OpenExtendSubProposalButtonActionChain.js`, `OpenTeamDialogButtonActionChain.json`, `PreviewButtonActionChain.json`, `ProjectSaveButtonActionChain.json`, `ProjectTableBeforeRowEditChain.json`, `ProjectTableBeforeRowEditEndChain.json`, `RefreshData.json`, `SaveAwardProjectsButtonActionChain.json`, `SaveCreditDialogButtonActionChain.json`, `SaveHeaderButtonActionChain.json`, `SaveProjectCostItemsButtonActionChain.json`, `SaveProjectCostLineButtonActionChain.json`, `SaveProjectTeamButtonActionChain.json`, `SaveProjectTeamMembersButtonActionChain.json`, `SelectValueChangeChain.js`, `SendToERPActionChain.js`, `SendToERPButtonActionChain.json`, `SwitchValueChangeChain.js`, `TeamTableBeforeRowEditChain.json`, `TeamTableBeforeRowEditEndChain.json`, `ToggleButtonActionChain.json`, `TrainBeforeSelectChain.json`, `TrainNextButtonActionChain.json`, `TrainPreviousButtonActionChain.json`, `TrainSelectChain.json`, `TreeViewSelectedChangeChain.json`, `UploadToObjectStorage.json`, `UserResponseActionChain.json`, `UserresponseCancelActionChain.json`, `beforeExitHandlerChain.json`, `cancelButtonActionChain.js`, `cancelButtonDialogActionChain.js`, `cancelProposalExtendButtonActionChain.js`, `checkboxValueUpdate.js`, `cloneAwardBtn.js`, `cloneAwardDialogClose.js`, `createProposal.json`, `entireAwardCheckAction.js`, `extendButtonClickActionChain.json`, `extendProposal.js`, `fetchProposalDataChain.json`, `getAwards.js`, `getPost_awardsAwardHeaderFetch.js`, `initializeChain.js`, `viewAwardClickChain.json`

## proposals-budget-research-partner-start-page

- Template: `webApps/app/flows/proposals/flows/proposals-budget-research-partner/pages/proposals-budget-research-partner-start-page.html`
- Page model: `webApps/app/flows/proposals/flows/proposals-budget-research-partner/pages/proposals-budget-research-partner-start-page.json`
- Page helper: `webApps/app/flows/proposals/flows/proposals-budget-research-partner/pages/proposals-budget-research-partner-start-page.js`
- Page-local chains: **21**
- Literal REST endpoints: `apps/deletePre_awardResearchPartnerLine`, `apps/getPre_awardResearchPartnerHeader`, `apps/getPre_awardResearchPartnerLine`, `apps/getPre_awards_costingGetCostItem`, `apps/postPre_awardResearchPartnerHeader`, `apps/postPre_awardResearchPartnerLine`, `getPre_awardGetLookupTypesCodes`, `getPre_awardResearchPartnerHeader`, `getPre_awardResearchPartnerLine`, `getPre_awards_costingGetCostItem`, `getProposalProposal_id`, `postPre_awardResearchPartnerHeader`, `postPre_awardResearchPartnerLine`
- Literal navigation page targets: none found in local chains
- Chain files: `AddCostButtonActionChain.json`, `CancelEditRowButtonActionChain.json`, `DeleteCostLineButtonActionChain.json`, `EditRowButtonActionChain.json`, `EditRowButtonActionChain_copy.json`, `SaveEditedRowActionChain.json`, `SaveResearchPartner.json`, `SaveRowButtonActionChain.json`, `SelectValueItemChangeChain.js`, `TableBeforeRowEditChain.json`, `TableBeforeRowEditEndChain.json`, `UserResponseActionChain.json`, `cancelEditAction.js`, `costCategory.json`, `costItem.json`, `fetchCostItems.json`, `fetchProposalDataChain.json`, `fetchProposalLockStatusChain.json`, `fetchResearchPartnerCostChain.json`, `initializeChain.json`, `saveEditedRowChain.js`

## proposals-budget-indirects-page

- Template: `webApps/app/flows/proposals/flows/proposals-budget/pages/proposals-budget-indirects-page.html`
- Page model: `webApps/app/flows/proposals/flows/proposals-budget/pages/proposals-budget-indirects-page.json`
- Page helper: `webApps/app/flows/proposals/flows/proposals-budget/pages/proposals-budget-indirects-page.js`
- Page-local chains: **3**
- Literal REST endpoints: `apps/getPre_awards_costingGetIndirectCostLines`, `getPre_awards_costingGetIndirectCostLines`, `getProposalProposal_id`
- Literal navigation page targets: `proposals-budget-start`
- Chain files: `bckButtonActionChain.json`, `fetchProposalDataActionChain.json`, `initialize.json`

## proposals-budget-non-staff-page

- Template: `webApps/app/flows/proposals/flows/proposals-budget/pages/proposals-budget-non-staff-page.html`
- Page model: `webApps/app/flows/proposals/flows/proposals-budget/pages/proposals-budget-non-staff-page.json`
- Page helper: `webApps/app/flows/proposals/flows/proposals-budget/pages/proposals-budget-non-staff-page.js`
- Page-local chains: **41**
- Literal REST endpoints: `apps/generateReport`, `apps/getPre_awards_costingGetCostHeaderDetails`, `apps/getPre_awards_costingGetCostItem`, `apps/getPre_awards_costingGetCostLineDetN`, `apps/getPre_awards_costingGetCostingLines`, `apps/getPre_awards_costingGetFundingHdr`, `apps/getPre_awards_costingGetProjectRoleFundHdr`, `apps/getPre_awards_costingGetSalFields`, `apps/getProposalEthical_dynFormsP_ref_module`, `apps/getProposalEthicaldynFormResponse`, `apps/getSharedGetCurrencyRate`, `apps/postPre_awards_costingGetTotFecCostLineN`, `apps/postPre_awards_costingInsertCostingHeaderN`, `apps/postPre_awards_costingSaveCostingDataN`, `apps/postProposalEthicaldynFormResponse`, `getPre_awardGetLookupTypesCodes`, `getPre_awards_costingGetCostItem`, `getPre_awards_costingGetCostLineDetN`, `getPre_awards_costingGetSalFields`, `getProposalEthical_dynFormsP_ref_module`, `getProposalProposal_id`, `ics/getGET_OBJECT1_0Objectstorage`, `postPre_awards_costingGetTotFecCostLineN`, `postPre_awards_costingInsertCostingHeaderN`, `postPre_awards_costingSaveCostingDataN`
- Literal navigation page targets: `proposals-budget-start`
- Chain files: `AddNewCostActionChain.js`, `AddNewCostLineActionChain.js`, `CalendarTypeValueItemChangeChain.js`, `CancelButtonActionChain.js`, `DeleteButtonActionChain.js`, `EditButtonActionChain.js`, `InputNumberValueChangeChain.js`, `InputNumberValueChangeChain1.js`, `TableBeforeRowEditChain.json`, `TableBeforeRowEditEndChain.json`, `assignDialogData.js`, `cancelAddNewCostLineButtonActionChain.js`, `costCategoryValueItemChangeChain.json`, `costItemtValueChangeChain.json`, `costSplitsAction.js`, `costSplitsActionChain.json`, `dynFilePickerSelectChain.json`, `dynLOVValueChangeChain.js`, `editRowActionChain.json`, `exitCheckActionChain.json`, `fetchCostDataActionChain.json`, `fetchCostItems.json`, `fetchCurrencyExchangeRatesChain.json`, `fetchDynamicRegion.json`, `fetchPageMetadata.json`, `fetchProposalDataActionChain.json`, `fundingSectionValueItemChangeChain.json`, `helperTextButtonActionChain.js`, `initialize.json`, `insertCostingHeaderActionChain.json`, `insertNewCostHeaderActionChain.json`, `moreInfoButtonActionChain.js`, `navigateBackActionChain.json`, `pageAccessGuard.js`, `resetToDefaultActionChain.json`, `saveCostActionChain.json`, `saveEditActionChain.json`, `showCalculationsActionChain.json`, `submitDynForm.json`, `userResponseActionChain.json`, `viewUploadedDocuments.json`

## proposals-budget-staff-page

- Template: `webApps/app/flows/proposals/flows/proposals-budget/pages/proposals-budget-staff-page.html`
- Page model: `webApps/app/flows/proposals/flows/proposals-budget/pages/proposals-budget-staff-page.json`
- Page helper: `webApps/app/flows/proposals/flows/proposals-budget/pages/proposals-budget-staff-page.js`
- Page-local chains: **58**
- Literal REST endpoints: `apps/generateReport`, `apps/getPre_awardGetLkpOrgUnitType`, `apps/getPre_awards_costingGetCostHeaderDetails`, `apps/getPre_awards_costingGetCostLineDetN`, `apps/getPre_awards_costingGetCostingHeaderProjectFTE2`, `apps/getPre_awards_costingGetCostingHeaderTotalFTE`, `apps/getPre_awards_costingGetCostingLines`, `apps/getPre_awards_costingGetFundingHdr`, `apps/getPre_awards_costingGetPersonMasterViewDetails`, `apps/getPre_awards_costingGetProjectRoleFundHdr`, `apps/getPre_awards_costingGetSalFields`, `apps/postPre_awards_costingGetTotFecCostLineN`, `apps/postPre_awards_costingInsertCostingHeaderN`, `apps/postPre_awards_costingSaveCostingDataN`, `getPre_awardGetLkpOrgUnitType`, `getPre_awardGetLookupTypesCodes`, `getPre_awardGetPersonList`, `getPre_awardGetProjectRoles`, `getPre_awards_costingGetCostLineDetN`, `getPre_awards_costingGetFundingHdr`, `getPre_awards_costingGetPersonMasterViewDetails`, `getPre_awards_costingGetSalFields`, `getPre_awards_costingGetSalModelList`, `getProposalEthical_dynFormsP_ref_module`, `getProposalEthicaldynFormResponse`, `getProposalProposal_id`, `getReportsGetStaffTimeReport`, `postPre_awards_costingGetTotFecCostLineN`, `postPre_awards_costingInsertCostingHeaderN`, `postPre_awards_costingSaveCostingDataN`
- Literal navigation page targets: `proposals-budget-start`
- Chain files: `AddNewCostActionChain.js`, `AddNewCostLineActionChain.js`, `AnnualDaysValueChangeChain.json`, `AnnualHoursValueChangeChain.json`, `CancelActionChain.js`, `CancelButtonActionChain.js`, `CancelDialogActionChain.js`, `DeleteButtonActionChain.js`, `EditButtonActionChain.js`, `EditRowActionChain.json`, `FTEValueChangeChain.json`, `FetchCostingPersonListChain.js`, `IndirectHeadersValueChangeChain.json`, `InputNumberValueChangeChain.js`, `InputSearchValueActionChain.json`, `OpenTimeLineActionChain.js`, `SalaryHeadersValueChangeChain.json`, `SaveEditActionChain.json`, `SearchValueChangeChain.json`, `SplitTypeValueItemChangeChain.js`, `TableBeforeRowEditChain.json`, `TableBeforeRowEditEndChain.json`, `assignDialogData.js`, `beforeExitActionChain.json`, `closeFteWarningAction.js`, `dynFilePickerSelectChain.js`, `dynLOVValueChangeChain.js`, `fetchCostDetailChain.json`, `fetchCostingHDRfromProjectRole.json`, `fetchDynamicRegion.js`, `fetchLOVChain.json`, `fetchPageMetadata.json`, `fetchPersonLovChain.json`, `fetchProposalDataChain.json`, `fetchTimelineDataActionChain.js`, `fundingSectionHDRValueChangeChain.json`, `getCostSplitsActionChain.json`, `getPre_awardGetProjectRolesFetch.js`, `getPre_awards_costingGetSalModelListFetch.js`, `helperTextButtonActionChain.js`, `initialize.json`, `insertCostHeaderActionChain.json`, `insertNewCostHeaderActionChain.json`, `moreInfoButtonActionChain.js`, `navigateBackActionChain.json`, `orgUnitValueChangeChain.js`, `pageAccessGuard.js`, `projectRoleValueChangeChain.json`, `recalculateCostLinesActionChain.json`, `resetToDefaultActionChain.json`, `salaryModelValueChangeChain.json`, `saveCostActionChain.json`, `showCalculationsActionChain.json`, `showStaffNotesActionChain.js`, `submitDynForm.js`, `unitTypeValueChangeChain.json`, `userResponseActionChain.json`, `viewUploadedDocuments.js`

## proposals-budget-start-page

- Template: `webApps/app/flows/proposals/flows/proposals-budget/pages/proposals-budget-start-page.html`
- Page model: `webApps/app/flows/proposals/flows/proposals-budget/pages/proposals-budget-start-page.json`
- Page helper: `webApps/app/flows/proposals/flows/proposals-budget/pages/proposals-budget-start-page.js`
- Page-local chains: **24**
- Literal REST endpoints: `apps/deletePre_awards_costingDeleteCostingData`, `apps/getPre_awards_costingGetCostSummary`, `apps/postPre_awards_costingDuplicateCost`, `getProposalGetLockStatus`, `getProposalProposal_id`
- Literal navigation page targets: `proposals-budget-indirects`, `proposals-budget-non-staff`, `proposals-budget-staff`
- Chain files: `AddStudentCostButtonActionChain.json`, `NavigateToSubProposalClickActionChain.js`, `ShowStaffDetailsActionChain.js`, `UserResponseActionChain.json`, `actionMenuActionChain.json`, `addNewCost.js`, `addNonStaffCostActionChain.json`, `addPoolTechnicianButtonActionChain.json`, `addResearchPartnerCostActionChain.js`, `addStaffCostActionChain.json`, `beforeExitHandlerChain.json`, `budgetVersionChangeChain.json`, `checkUserResponseActionChain.js`, `closeFxRates.js`, `deleteItem.js`, `fetchCostItemDataActionChain.json`, `fetchDataForProposal.json`, `fetchProposalLockStatusChain.json`, `initialize.json`, `itemUpdated.js`, `openQuickCosting.js`, `saveCosting.js`, `showFxRates.js`, `templateSelected.js`

## proposals-contracts-start-page

- Template: `webApps/app/flows/proposals/flows/proposals-contracts/pages/proposals-contracts-start-page.html`
- Page model: `webApps/app/flows/proposals/flows/proposals-contracts/pages/proposals-contracts-start-page.json`
- Page helper: `webApps/app/flows/proposals/flows/proposals-contracts/pages/proposals-contracts-start-page.js`
- Page-local chains: **6**
- Literal REST endpoints: `apps/getGetAllContracts`, `getProposalProposal_id`
- Literal navigation page targets: `/shell/contracts/contracts-new-contract`
- Chain files: `MenuActionChain.json`, `btnCreateContractActionChain.js`, `createContractActionChain.json`, `fetchProposalDataChain.json`, `initialize.json`, `vbBeforeExit.json`

## proposals-delegation-start-page

- Template: `webApps/app/flows/proposals/flows/proposals-delegation/pages/proposals-delegation-start-page.html`
- Page model: `webApps/app/flows/proposals/flows/proposals-delegation/pages/proposals-delegation-start-page.json`
- Page helper: `webApps/app/flows/proposals/flows/proposals-delegation/pages/proposals-delegation-start-page.js`
- Page-local chains: **1**
- Literal REST endpoints: none found in local chains
- Literal navigation page targets: none found in local chains
- Chain files: `initialize.js`

## proposals-due-diligence-start-page

- Template: `webApps/app/flows/proposals/flows/proposals-due-diligence/pages/proposals-due-diligence-start-page.html`
- Page model: `webApps/app/flows/proposals/flows/proposals-due-diligence/pages/proposals-due-diligence-start-page.json`
- Page helper: `webApps/app/flows/proposals/flows/proposals-due-diligence/pages/proposals-due-diligence-start-page.js`
- Page-local chains: **23**
- Literal REST endpoints: `apps/getDynamicFormsApplicationList`, `apps/getPre_awardAttachmentsProposal_id`, `apps/getProposalEthical_dynFormsP_ref_module`, `apps/getProposalEthicaldynFormResponse`, `apps/getProposalGetApplicationList`, `apps/postPre_awardAttachments`, `apps/postProposalEthicaldynFormResponse`, `getPre_awardAttachmentsProposal_id`, `getProposalEthical_dynFormsP_ref_module`, `getProposalGetApplicationList`, `getProposalProposal_id`, `ics/putUPLOAD_OBJECT1_0Objectstorage`, `postPre_awardAttachments`
- Literal navigation page targets: none found in local chains
- Chain files: `AddDocumentButtonActionChain.json`, `CancelAddAttachmentButtonActionChain.json`, `CreateNewDueDiligenceActionChain.js`, `FilePickerSelectChain.json`, `OpenAddAttachmentButtonActionChain.json`, `SubmitButtonActionChain.json`, `ViewAttachmentsButtonActionChain.json`, `closeLinkDueDiligenceDialog.js`, `dynFormCheckListValueChangeChain.js`, `dynLOVValueChangeChain.js`, `fetchDueDiligenceApplicationDataChain.json`, `fetchDueDiligenceDataChain.js`, `fetchDynamicFormMetadataChain.json`, `fetchLockDataChain.json`, `fetchProposalDataActionChain.js`, `fetchProposalDataChain.json`, `helperTextButtonActionChain.js`, `initialize.json`, `initializeChain.js`, `openLinkDueDiligenceDialog.js`, `submitLinkDueDiligence.js`, `userResponseActionChain.json`, `viewButtonActionChain.js`

## proposals-dynamic-form-1-start-page

- Template: `webApps/app/flows/proposals/flows/proposals-dynamic-form-1/pages/proposals-dynamic-form-1-start-page.html`
- Page model: `webApps/app/flows/proposals/flows/proposals-dynamic-form-1/pages/proposals-dynamic-form-1-start-page.json`
- Page helper: `webApps/app/flows/proposals/flows/proposals-dynamic-form-1/pages/proposals-dynamic-form-1-start-page.js`
- Page-local chains: **5**
- Literal REST endpoints: none found in local chains
- Literal navigation page targets: none found in local chains
- Chain files: `FragmentExitRequestedChain.js`, `reloadProposalDataListener.js`, `reloadProposalLockDataListener.js`, `vbBeforeExitListener.js`, `vbEnterListener.js`

## proposals-dynamic-form-2-start-page

- Template: `webApps/app/flows/proposals/flows/proposals-dynamic-form-2/pages/proposals-dynamic-form-2-start-page.html`
- Page model: `webApps/app/flows/proposals/flows/proposals-dynamic-form-2/pages/proposals-dynamic-form-2-start-page.json`
- Page helper: `webApps/app/flows/proposals/flows/proposals-dynamic-form-2/pages/proposals-dynamic-form-2-start-page.js`
- Page-local chains: **5**
- Literal REST endpoints: none found in local chains
- Literal navigation page targets: none found in local chains
- Chain files: `FragmentExitRequestedChain.js`, `reloadProposalDataListener.js`, `reloadProposalLockDataListener.js`, `vbBeforeExitListener.js`, `vbEnterListener.js`

## proposals-dynamic-form-3-start-page

- Template: `webApps/app/flows/proposals/flows/proposals-dynamic-form-3/pages/proposals-dynamic-form-3-start-page.html`
- Page model: `webApps/app/flows/proposals/flows/proposals-dynamic-form-3/pages/proposals-dynamic-form-3-start-page.json`
- Page helper: `webApps/app/flows/proposals/flows/proposals-dynamic-form-3/pages/proposals-dynamic-form-3-start-page.js`
- Page-local chains: **5**
- Literal REST endpoints: none found in local chains
- Literal navigation page targets: none found in local chains
- Chain files: `FragmentExitRequestedChain.js`, `reloadProposalDataListener.js`, `reloadProposalLockDataListener.js`, `vbBeforeExitListener.js`, `vbEnterListener.js`

## proposals-dynamic-form-4-start-page

- Template: `webApps/app/flows/proposals/flows/proposals-dynamic-form-4/pages/proposals-dynamic-form-4-start-page.html`
- Page model: `webApps/app/flows/proposals/flows/proposals-dynamic-form-4/pages/proposals-dynamic-form-4-start-page.json`
- Page helper: `webApps/app/flows/proposals/flows/proposals-dynamic-form-4/pages/proposals-dynamic-form-4-start-page.js`
- Page-local chains: **5**
- Literal REST endpoints: none found in local chains
- Literal navigation page targets: none found in local chains
- Chain files: `FragmentExitRequestedChain.js`, `reloadProposalDataListener.js`, `reloadProposalLockDataListener.js`, `vbBeforeExitListener.js`, `vbEnterListener.js`

## proposals-dynamic-form-5-start-page

- Template: `webApps/app/flows/proposals/flows/proposals-dynamic-form-5/pages/proposals-dynamic-form-5-start-page.html`
- Page model: `webApps/app/flows/proposals/flows/proposals-dynamic-form-5/pages/proposals-dynamic-form-5-start-page.json`
- Page helper: `webApps/app/flows/proposals/flows/proposals-dynamic-form-5/pages/proposals-dynamic-form-5-start-page.js`
- Page-local chains: **5**
- Literal REST endpoints: none found in local chains
- Literal navigation page targets: none found in local chains
- Chain files: `FragmentExitRequestedChain.js`, `reloadProposalDataListener.js`, `reloadProposalLockDataListener.js`, `vbBeforeExitListener.js`, `vbEnterListener.js`

## proposals-ethics-start-page

- Template: `webApps/app/flows/proposals/flows/proposals-ethics/pages/proposals-ethics-start-page.html`
- Page model: `webApps/app/flows/proposals/flows/proposals-ethics/pages/proposals-ethics-start-page.json`
- Page helper: `webApps/app/flows/proposals/flows/proposals-ethics/pages/proposals-ethics-start-page.js`
- Page-local chains: **10**
- Literal REST endpoints: `apps/getProposalGetApplicationList`, `getDynamicFormsApplicationList`, `getProposalEthical_dynFormsP_ref_module`, `getProposalGetEthicsList`, `getProposalProposal_id`
- Literal navigation page targets: none found in local chains
- Chain files: `CreateNewEthicsActionChain.js`, `ViewEthicalApplicationButtonActionChain.js`, `beforeExitHandlerChain.js`, `dynFormLOVValueItemChangeChain.js`, `dynLOVValueChangeChain.js`, `fetchEthicalDataFormActionChain.json`, `fetchLockStatusChain.json`, `fetchProposalDataActionChain.json`, `finalizeHandlerChain.json`, `initialize.json`

## proposals-fec-summary-start-page

- Template: `webApps/app/flows/proposals/flows/proposals-fec-summary/pages/proposals-fec-summary-start-page.html`
- Page model: `webApps/app/flows/proposals/flows/proposals-fec-summary/pages/proposals-fec-summary-start-page.json`
- Page helper: `webApps/app/flows/proposals/flows/proposals-fec-summary/pages/proposals-fec-summary-start-page.js`
- Page-local chains: **8**
- Literal REST endpoints: none found in local chains
- Literal navigation page targets: none found in local chains
- Chain files: `clearFilters.js`, `clearUserQuery.js`, `filterChanged.js`, `generateReport.js`, `initialize.js`, `loadFrequentResult.js`, `queryKeyControl.js`, `refreshProposalData.js`

## proposals-history-start-page

- Template: `webApps/app/flows/proposals/flows/proposals-history/pages/proposals-history-start-page.html`
- Page model: `webApps/app/flows/proposals/flows/proposals-history/pages/proposals-history-start-page.json`
- Page helper: `webApps/app/flows/proposals/flows/proposals-history/pages/proposals-history-start-page.js`
- Page-local chains: **9**
- Literal REST endpoints: `apps/getPost_awardsExtendedProjects`, `apps/getPre_awards_costingBudget_version`, `apps/getProposalAddStatusConfidential`, `apps/getProposalEthical_dynFormsP_ref_module`, `apps/getProposalEthicaldynFormResponse`, `apps/postProposalEthicaldynFormResponse`, `getPre_awards_costingBudget_version`, `getProposalEthical_dynFormsP_ref_module`, `getProposalProposal_id`
- Literal navigation page targets: none found in local chains
- Chain files: `SubmitDynResponseButtonActionChain.json`, `beforeExitHandlerChain.json`, `dynLOVValueChangeChain.js`, `fetchDynamicRegionChain.json`, `fetchProposalDataAction.js`, `fetchProposalDataActionChain.json`, `helperTextButtonActionChain.js`, `initializeChain.js`, `onStatusAdded.js`

## proposals-inkind-contribution-start-page

- Template: `webApps/app/flows/proposals/flows/proposals-inkind-contribution/pages/proposals-inkind-contribution-start-page.html`
- Page model: `webApps/app/flows/proposals/flows/proposals-inkind-contribution/pages/proposals-inkind-contribution-start-page.json`
- Page helper: `webApps/app/flows/proposals/flows/proposals-inkind-contribution/pages/proposals-inkind-contribution-start-page.js`
- Page-local chains: **17**
- Literal REST endpoints: `apps/deletePre_awardPropinkindcostline`, `apps/getPre_awardInkindCostItems`, `apps/getPre_awardPropinkind`, `apps/getPre_awardPropinkindcostline`, `apps/getPre_awards_costingGetPricingDetails`, `apps/postPre_awardPropinkindcostline`, `getPre_awardGetLookupTypesCodes`, `getPre_awardInkindCostItems`, `getPre_awardPropinkind`, `getPre_awardPropinkindcostline`, `getPre_awards_costingGetPricingDetails`, `getProposalProposal_id`, `postPre_awardPropinkind`, `postPre_awardPropinkindcostline`
- Literal navigation page targets: none found in local chains
- Chain files: `AddContributionActionChain.json`, `AddContributionDialogButtonActionChain.json`, `CancelEditButtonActionChain.json`, `DeleteInkindButtonActionChain.json`, `DoneEditButtonActionChain.json`, `EditButtonActionChain.json`, `ExitHandlerChain.json`, `SaveInkindButtonActionChain.json`, `TableBeforeRowEditChain.json`, `TableBeforeRowEditEndChain.json`, `addNewInKindContribution.js`, `fetchInkindDataChain.json`, `fetchLockDataChain.json`, `fetchProposalDataChain.json`, `initialize.json`, `saveTotalContribution.js`, `totalValueChangeChain.js`

## proposals-pricing-start-page

- Template: `webApps/app/flows/proposals/flows/proposals-pricing/pages/proposals-pricing-start-page.html`
- Page model: `webApps/app/flows/proposals/flows/proposals-pricing/pages/proposals-pricing-start-page.json`
- Page helper: `webApps/app/flows/proposals/flows/proposals-pricing/pages/proposals-pricing-start-page.js`
- Page-local chains: **44**
- Literal REST endpoints: `apps/getPre_awards_costingGetDefaultPricing`, `apps/getPre_awards_costingGetPricingDetails`, `apps/getSharedGetCurrencyRate`, `apps/postPre_awards_costingInsertPricingLines`, `getPre_awardGetLookupTypesCodes`, `getPre_awards_costingGetPricingDetails`, `getProposalGetLockStatus`, `getProposalProposal_id`, `postPre_awards_costingInsertPricingLines`
- Literal navigation page targets: none found in local chains
- Chain files: `CancelEditPricingLineActionChain.json`, `CurrencyValueChangeChain.js`, `FunderCostValueChangeChain.json`, `FunderPCTValueChangeChain.json`, `InstitutionCostValueChangeChain.json`, `InstitutionPercentValueChangeChain.json`, `ResetToDefaultButtonActionChain.json`, `SaveEditPricingLineActionChain.json`, `SubProposalHyperlinkClickChain.js`, `TableBeforeRowEditChain.json`, `TableBeforeRowEditEndChain.json`, `beforeExitHandlerChain.json`, `btnGlobalPercentValueChangeChain.json`, `cancelButtonActionChain.json`, `cancelEditButtonActionChain.json`, `cancelFunderRowEdit.js`, `closeFxRates.js`, `closeInstitutionalFundingDialog.js`, `costChangeAC.js`, `editInstitutionContribution.js`, `editRowAC.js`, `editRowActionChain.json`, `fetchCurrencyRate.json`, `fetchDefaultPricingData.json`, `fetchLockStatusChain.json`, `fetchPricingDataActionChain.json`, `fetchProposalDataActionChain.json`, `funderGlobalValueChangeChain.json`, `funderPCTunindexValueChangeChain.json`, `globalFunderPCTValueChangeChain.json`, `globalInstPCTValueChangeChain.json`, `initialize.json`, `institutionGlobalValueChangeChain.json`, `moreInfoButtonActionChain.js`, `priceCostChangeAC.js`, `pricingDataChanged.js`, `refreshDialogTableData.js`, `saveFunderDetails.js`, `saveInstitutionCost.js`, `savePricingActionChain.json`, `saveRowActionChain.json`, `showEditFunderData.js`, `showFxRates.js`, `userResponseActionChain.json`

## proposals-sponsor-due-diligence-start-page

- Template: `webApps/app/flows/proposals/flows/proposals-sponsor-due-diligence/pages/proposals-sponsor-due-diligence-start-page.html`
- Page model: `webApps/app/flows/proposals/flows/proposals-sponsor-due-diligence/pages/proposals-sponsor-due-diligence-start-page.json`
- Page helper: `webApps/app/flows/proposals/flows/proposals-sponsor-due-diligence/pages/proposals-sponsor-due-diligence-start-page.js`
- Page-local chains: **17**
- Literal REST endpoints: `apps/getPre_awardAttachmentsProposal_id`, `apps/getProposalEthical_dynFormsP_ref_module`, `apps/getProposalEthicaldynFormResponse`, `apps/postPre_awardAttachments`, `apps/postProposalEthicaldynFormResponse`, `apps/postSharedObjectStatus`, `getPre_awardAttachmentsProposal_id`, `getProposalEthical_dynFormsP_ref_module`, `getProposalProposal_id`, `ics/putUPLOAD_OBJECT1_0Objectstorage`, `postPre_awardAttachments`
- Literal navigation page targets: none found in local chains
- Chain files: `AddDocumentButtonActionChain.json`, `CancelAddAttachmentButtonActionChain.json`, `FilePickerSelectChain.json`, `OpenAddAttachmentButtonActionChain.json`, `SubmitButtonActionChain.json`, `ViewAttachmentsButtonActionChain.json`, `beforeExitActionChain.json`, `checkListValueChange.js`, `checkboxValueChange.js`, `dynLOVValueChangeChain.js`, `fetchDynamicFormMetadataChain.json`, `fetchLockDataChain.json`, `fetchProposalDataChain.json`, `initialize.json`, `moreInfoButtonActionChain.js`, `submitToSponsorButtonActionChain.json`, `userResponseActionChain.json`

## proposals-summary-start-page

- Template: `webApps/app/flows/proposals/flows/proposals-summary/pages/proposals-summary-start-page.html`
- Page model: `webApps/app/flows/proposals/flows/proposals-summary/pages/proposals-summary-start-page.json`
- Page helper: `webApps/app/flows/proposals/flows/proposals-summary/pages/proposals-summary-start-page.js`
- Page-local chains: **79**
- Literal REST endpoints: `GetSponsorList`, `apps/GetSponsorList`, `apps/deletePre_awardAttachmentsId`, `apps/deletePre_awardDeleteCollaboratorProp_collab_rltn_id`, `apps/getOpportunitiesGetOpportunityCategory`, `apps/getPre_awardGetCollaboratorList`, `apps/getPre_awardGetPersonList`, `apps/getPre_awardGetPersonListAll`, `apps/getPre_awardGetSponsorTypes`, `apps/getPre_awards_costingGetCostModel`, `apps/getProposalCopyProposalObjList`, `apps/getProposalEthical_dynFormsP_ref_module`, `apps/getProposalEthicaldynFormResponse`, `apps/postPre_awardAttachments`, `apps/postProposal`, `apps/postProposalCopyProposal`, `apps/postProposalEthicaldynFormResponse`, `getOpportunitiesGetOpportunityCategory`, `getPre_awardGetCollaboratorList`, `getPre_awardGetLkpOrgUnitType`, `getPre_awardGetLookupTypesCodes`, `getPre_awardGetPersonList`, `getPre_awardGetSponsorTypes`, `getPre_awards_costingGetCostModel`, `getProposalEthical_dynFormsP_ref_module`, `getProposalEthicaldynFormResponse`, `getProposalGetLockStatus`, `getProposalGetProposalDetailsProposal_number`, `getProposalProposal_id`, `getSharedGetObjectAttributes`, `ics/deleteDELETE_OBJECT1_0Objectstorage`, `ics/getGET_OBJECT1_0Objectstorage`, `ics/putUPLOAD_OBJECT1_0Objectstorage`, `postProposal`
- Literal navigation page targets: none found in local chains
- Chain files: `AddDeadline.js`, `AddDeadlineCancel.js`, `AddNewDeadLineActionChain.js`, `AttributeValueChangeChain.js`, `ButtonActionChain.js`, `ButtonActionChainPricingDialog.json`, `CalculateMonthsEndDateChangeChain.js`, `CancelEditActionChain.json`, `CancelEditDeadlineActionChain.js`, `ClearFilterPIActionChain.js`, `CollabComboValueChangeChain.json`, `CollaboratorFlagValueChangeChain.json`, `ComboValueChangeChain.json`, `DeadlineTypeValueItemChangeChain.json`, `DeleteAttachmentActionChain.js`, `DeleteDeadlineActionChain.js`, `DynamicButtonActionChain.json`, `EditDeadlineActionChain.js`, `EditRowActionChain.json`, `GovSponsorTypeValueChangeChain.json`, `InputRichText2SpTertiaryActionChain.js`, `InputTextValueChangeChain.js`, `OrgIdValueItemChangeChain.json`, `SaveEditDeadlineActionChain.js`, `SelectPIButtonActionChain.json`, `SelectValueItemChangeChain.js`, `SponsorValueChangeChain.json`, `SubProposalFlagValueChangeChain.json`, `SubProposalTypeValueItemChangeChain.json`, `TableBeforeRowEditChain.json`, `TableBeforeRowEditChainJS.js`, `TableBeforeRowEditEndChain.json`, `beforeExitHandlerChain.json`, `calculateDuration.js`, `cancelEditProposalAction.js`, `cancelEditProposalActionChain.json`, `confidentialValueChange.js`, `convertToProposalButtonActionChain.json`, `convertToProposalListener.js`, `createProposalActionChain.json`, `deleteDocuments.json`, `deleteRecordActionChain.json`, `dialogConvertCloseButtonActionChain.js`, `doneEditActionChain.json`, `downloadUploadedDocuments.js`, `durationChange.js`, `durationMonthsValueChangeChain.js`, `dynFilePickerSelectChain.json`, `dynLOVValueChangeChain.js`, `fetchAttachementsDataChain.js`, `fetchCategoriesChain.json`, `fetchDataFromProposalAction.js`, `fetchDataFromProposalActionChain.json`, `fetchDynamicRegionChain.json`, `fetchLOVActionChain.json`, `fetchLockStatusActionChain.json`, `filePickerSelectChain.js`, `finalizeProposalSummaryListener.js`, `helperTextButtonActionChain.js`, `initialize.json`, `loadPersonDataChain.json`, `loadProposalLookupsChain.js`, `moreInfoButtonActionChain.js`, `navigateToSP.js`, `openPISearchDialogActionChain.json`, `openPiSearchActionChain.js`, `partnerDescriptionAC.js`, `piNameValueItemChangeChain.json`, `rteValueChangeChain.js`, `saveAttributes.js`, `saveProposal.js`, `sponsorCheckActionChain.json`, `sponsorPriorityChange.js`, `toggleProposalEditHandler.json`, `uploadDocuments.json`, `uploadDocumentsActionChain.js`, `userResponseActionChain.json`, `versionDialogClose.js`, `viewUploadedDocuments.json`

## proposals-info-start-page

- Template: `webApps/app/flows/proposals/pages/proposals-info-start-page.html`
- Page model: `webApps/app/flows/proposals/pages/proposals-info-start-page.json`
- Page helper: `webApps/app/flows/proposals/pages/proposals-info-start-page.js`
- Page-local chains: **63**
- Literal REST endpoints: `apps/generateReport`, `apps/getPre_awardGetPersonList`, `apps/getPre_awards_costingBudget_version`, `apps/getProposalComments`, `apps/getProposalContactDtls`, `apps/getProposalGetLockStatus`, `apps/getReportsGetObjectRef`, `apps/getSharedFinalizablePages`, `apps/getSharedGetCurrencyRate`, `apps/getSharedGetObjectAudits2`, `apps/postPre_awards_costingBudget_version`, `apps/postPre_awards_costingCreateBudgetVersion`, `getPre_awards_costingAuditTrail`, `getPre_awards_costingBudget_version`, `getProposalComments`, `getProposalGetLockStatus`, `getProposalProposal_id`, `getReportsGetObjectRef`, `getSharedFinalizablePages`, `getSharedGetCurrencyRate`, `getSharedGetObjectAudits2`, `postPre_awards_costingBudget_version`, `postPre_awards_costingCreateBudgetVersion`, `postPre_awards_costingUpdateBudgetVersion`, `postProposalComments`, `postProposalInsertModuleLock2`
- Literal navigation page targets: `proposals-awards-start`, `proposals-budget-research-partner-start`, `proposals-contracts-start`, `proposals-due-diligence-start`, `proposals-dynamic-form-5-start`, `proposals-ethics-start`, `proposals-fec-summary-start`, `proposals-info-start/proposals-allocation-for-credit/proposals-allocation-for-credit-start`, `proposals-info-start/proposals-approvals/proposals-approvals-start`, `proposals-info-start/proposals-attachments/proposals-attachments-start`, `proposals-info-start/proposals-budget/proposals-budget-start`, `proposals-info-start/proposals-delegation/proposals-delegation-start`, `proposals-info-start/proposals-history/proposals-history-start`, `proposals-info-start/proposals-inkind-contribution`, `proposals-info-start/proposals-pricing/proposals-pricing-start`, `proposals-info-start/proposals-summary/proposals-summary-start`, `proposals-sponsor-due-diligence-start`, `{{ $variables.selection }}`
- Chain files: `AuditDrawerCloseChain.js`, `BudgetVersionValueItemChangeChain.json`, `CancelUpdateBudgetName.js`, `CommentsCloseActionChain.json`, `CommentsDrawerOpenedChangeChain.json`, `CreateBudgetButtonActionChain.json`, `CreateNewVersionButtonActionChain.json`, `DrawerPopupOpenedChangeChain.js`, `EditBudgetNameAction.js`, `EditOrSaveProposalActionChain.json`, `FinalizeValueChangeActionChain.js`, `HandleMentionDeepLinkChain.js`, `MarkBudgetVersionAsActiveActionChain.json`, `NavigateBackActionChain.json`, `NavigateToListButtonActionChain.json`, `NavigationListSelectionChangeActionChain.js`, `NavigationListSelectionChangeChain.json`, `OpenAuditDrawerButtonActionChain.json`, `PrintMenuActionChain.json`, `RefreshCommentsForCurrentFlowChain.js`, `ViablityButtonActionChain.js`, `beforeEnterHandlerChain.js`, `beforeExitHandlerChain.js`, `btnOkayActionChain.json`, `budgetVersionActionChain.js`, `cancelDeleteBudgetVersion.js`, `closeFxRates.js`, `compareProposal.js`, `createNewVersion.js`, `deleteBudgetVersion.js`, `deleteButtonAction.js`, `exitHandlerActionChain.json`, `exitHandlerJSActionChain.js`, `fetchAISummary.js`, `fetchContactDetails.json`, `fetchCurrencyExchangeRates.json`, `fetchLockAndFinalizeStatusChain.json`, `fetchPersonListChain.json`, `fetchProposalPagesJS.js`, `fetchProposalSummaryActionChain.js`, `fetchViablityChecksDataActionChain.js`, `fireConvertToProposal.js`, `getProposalCommentsFetchAction.json`, `getReportPrintPageActionChain.json`, `getfinalizablePagesChain.json`, `initializeChain.js`, `moreInfoButtonActionChain.js`, `navigateToOutlineProposal.js`, `navigateToProposal.js`, `openCommentsDrawerActionChain.json`, `openQuickCosting.js`, `parentProposalNumberClickChain.json`, `refreshProposalHandlerActionChain.js`, `refreshTabChain.js`, `resendRecordListener.js`, `saveUpdatedBugetAction.js`, `sendPropToERP.js`, `setLockModuleIDListener.js`, `showCreatorDetails.js`, `showFxRates.js`, `subFlowAccessGuard.js`, `toggleEditProposalHandler.json`, `userResponseActionChain.json`

## proposals-start-page

- Template: `webApps/app/flows/proposals/pages/proposals-start-page.html`
- Page model: `webApps/app/flows/proposals/pages/proposals-start-page.json`
- Page helper: `webApps/app/flows/proposals/pages/proposals-start-page.js`
- Page-local chains: **67**
- Literal REST endpoints: `apps/GetSponsorList`, `apps/deleteProposalProposalProposal_id`, `apps/getPre_awardGetLkpOrgUnitType`, `apps/getProposalCopyProposalObjList`, `apps/getProposalPages`, `apps/getProposalRestoreProposalProposal_id`, `apps/getProposalsListAdvanced`, `apps/getReportsGetObjectRef`, `apps/getSharedGetObjectAttributes`, `apps/postProposal`, `apps/postProposalCopyProposal`, `apps/postProposalDelegations`, `getPre_awardGetDeletedProposalsList`, `getPre_awardGetLkpOrgUnitType`, `getPre_awardGetLookupTypesCodes`, `getPre_awardGetPersonList`, `getPre_awardGetProposalsList`, `getProposalCopyProposalObjList`, `getReportsGetObjectRef`, `getSharedObjectLinked2`, `getTestPivotTest`, `postProposalCopyProposal`
- Literal navigation page targets: `/shell/proposals/proposals-info-start/proposals-summary/proposals-summary-start`, `[[ [`, `proposals-info-start`, `proposals-info-start/proposals-summary`, `proposals-info-start/proposals-summary/proposals-summary-start`, `string`
- Chain files: `ActionsHandler.json`, `AddFilterRowButtonChain.js`, `AdvFilterCloseButtonActionChain.json`, `AllAccessValueChangeChain.json`, `AllCheckboxSetValueChangeChain.js`, `AllProposalCheckboxSetValueChangeChain.js`, `CalculateMonthsEndDateChangeChain.js`, `CancelAttachmentsActionChain.js`, `CheckboxSetValueChangeActionChain.js`, `CheckboxSetValueChangeChain.json`, `ClearFilterActionChain.json`, `CloneEntireProposalValueChangeChain.json`, `ClosFilterDrawerActionChain.json`, `CreateProposalAction.json`, `CreateProposalButtonActionChain.json`, `DeleteFilterRowButtonActionChain.json`, `LinkedButtonActionChain.js`, `SelectValueItemChangeChain.json`, `SponsorValueItemChangeChain.json`, `ToggleAdvacedFilterButtonActionChain.json`, `ToggleEndDrawerButtonActionChain.json`, `ToggleFilterActionChain.json`, `ToggleStartFilterOptionsButtonActionChain.json`, `UserResponseDataActionChain.js`, `allAccessChange.js`, `calculateDuration.js`, `cancelButtonActionChain.js`, `cancelEditFilterRow.js`, `cancelOutlineAOIButtonActionChain.js`, `cancelWarningAction.js`, `checkAccess.js`, `checkBoxUpdate.js`, `checkBoxValueUpdate.js`, `cloneDialogCloseChain.json`, `confidentialValueChange.js`, `createFromAOIButtonAction.js`, `dialogCloseButtonActionChain.json`, `dialogDeleteButtonActionChain.json`, `durationChange.js`, `durationMonthsValueChangeChain.js`, `entireProposalChecked.js`, `fetchLOV.json`, `getDynamicFormsAllRequestsFetch.js`, `getPre_awardGetDeletedProposalsListFetch.js`, `getPre_awardGetProposalsListFetch.js`, `getProposalsListAdvancedFetch.js`, `initialize.json`, `navigateToProposalActionChain.json`, `navigationHandler.json`, `openFunderWarningAction.js`, `outlineButtonActionChain.js`, `recycleBinButtonActionChain.json`, `refreshProposalAttributesChain.json`, `refreshProposalsActionChain.js`, `restoreButtonActionChain.json`, `saveEditFilterRow.js`, `shareAccessButtonActionChain.js`, `shareAsDocumentButtonActionChain.js`, `shareButtonActionChain.js`, `shareDocButtonActionChain.js`, `showAOIButtonActionChain.js`, `sortOrderChange.js`, `sortProposals.js`, `startEditFilterRow.js`, `submitDelegation.json`, `userResponseActionChain.json`, `viewLinkedModuleActionChain.js`
