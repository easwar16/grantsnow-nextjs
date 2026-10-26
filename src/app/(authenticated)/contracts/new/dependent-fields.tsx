"use client";
import { useEffect, useState } from "react";
import { loadContractFormChoices } from "./actions";

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
  const [dependent, setDependent] = useState<{
    templates: Choice[];
    items: Choice[];
  }>({ templates: [], items: [] });
  const [error, setError] = useState("");
  useEffect(() => {
    if (!contractType && !relationType) return;
    let active = true;
    loadContractFormChoices({ contractType, relationType, orgId })
      .then((value) => {
        if (active) {
          setDependent(value);
          setError("");
        }
      })
      .catch(() => {
        if (active) {
          setDependent({ templates: [], items: [] });
          setError("Contract choices are unavailable.");
        }
      });
    return () => {
      active = false;
    };
  }, [contractType, relationType, orgId]);
  return (
    <>
      {visible.type && (
        <label>
          {labels.type} <b>*</b>
          <select
            name="contract_type"
            required
            value={contractType}
            onChange={(event) => setContractType(event.target.value)}
          >
            <option value="">Select Contract Type</option>
            {types.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {visible.relation && (
        <label>
          {labels.relation}
          <select
            name="contract_level"
            value={relationType}
            onChange={(event) => setRelationType(event.target.value)}
          >
            <option value="">Select Contract Relation Type</option>
            {relations.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {visible.item && (
        <label>
          {labels.item}
          <select
            name="object_ref_id"
            defaultValue=""
            key={`item-${relationType}-${orgId}`}
            disabled={!relationType}
          >
            <option value="">Select Relation Item</option>
            {dependent.items.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {visible.template && (
        <label>
          {labels.template}
          <select
            name="template_id"
            defaultValue=""
            key={`template-${contractType}-${relationType}`}
            disabled={!contractType}
          >
            <option value="">Select Contract template</option>
            {dependent.templates.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {visible.org && (
        <label>
          {labels.org}
          <select
            name="org_id"
            value={orgId}
            onChange={(event) => setOrgId(event.target.value)}
          >
            <option value="">Select Org Unit</option>
            {orgs.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {error && <p role="status">{error}</p>}
    </>
  );
}
