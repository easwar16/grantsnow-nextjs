"use client";
import { FormSelect } from "@/components/ui/form-select";
import { useState } from "react";
import { contracts, useApi } from "@/lib/api";

type Choice = { value: string; label: string };
export function DependentFields({
  types,
  relations,
  orgs,
  labels,
  visible,
}: {
  types: Choice[];
  relations: Choice[];
  orgs: Choice[];
  labels: {
    type: string;
    relation: string;
    item: string;
    template: string;
    org: string;
  };
  visible: {
    type: boolean;
    relation: boolean;
    item: boolean;
    template: boolean;
    org: boolean;
  };
}) {
  const [contractType, setContractType] = useState("");
  const [relationType, setRelationType] = useState("");
  const [orgId, setOrgId] = useState("");
  const { data, error } = useApi(
    contracts.choices,
    contractType || relationType ? { contractType, relationType, orgId } : null,
  );
  const dependent = data ?? { templates: [], items: [] };
  return (
    <>
      {visible.type && (
        <label>
          {labels.type} <b>*</b>
          <FormSelect
            id="contract-new-type"
            name="contract_type"
            label={labels.type}
            options={types}
            required
            value={contractType}
            onChange={setContractType}
          />
        </label>
      )}
      {visible.relation && (
        <label>
          {labels.relation}
          <FormSelect
            id="contract-new-relation"
            name="contract_level"
            label={labels.relation}
            options={relations}
            value={relationType}
            onChange={setRelationType}
          />
        </label>
      )}
      {visible.item && (
        <label>
          {labels.item}
          <FormSelect
            key={`item-${relationType}-${orgId}`}
            id="contract-new-item"
            name="object_ref_id"
            label={labels.item}
            options={dependent.items}
            disabled={!relationType}
          />
        </label>
      )}
      {visible.template && (
        <label>
          {labels.template}
          <FormSelect
            key={`template-${contractType}-${relationType}`}
            id="contract-new-template"
            name="template_id"
            label={labels.template}
            options={dependent.templates}
            disabled={!contractType}
          />
        </label>
      )}
      {visible.org && (
        <label>
          {labels.org}
          <FormSelect
            id="contract-new-org"
            name="org_id"
            label={labels.org}
            options={orgs}
            value={orgId}
            onChange={setOrgId}
          />
        </label>
      )}
      {error && (
        <p id="contract-new-choices-error" role="status">
          Contract choices are unavailable.
        </p>
      )}
    </>
  );
}
