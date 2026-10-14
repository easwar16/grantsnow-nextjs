import Link from "next/link";
import { z } from "zod";
import { pageIdentity } from "@/server/auth/page";
import { requireModule } from "@/server/permissions/policy";
import { authenticate } from "@/server/session/service";
import { oracle } from "@/server/api/transport";
import { State } from "@/components/feedback/state";
import { publicError } from "@/lib/errors";
export const metadata = { title: "Opportunity registration" };
const definitions = z.array(
  z.object({
    formId: z.number(),
    formName: z.string(),
    sections: z.array(
      z.object({
        sectionId: z.number(),
        sectionName: z.string(),
        isVisible: z.string(),
        fields: z
          .array(
            z.object({
              fieldId: z.number(),
              description: z.string(),
              isVisible: z.string(),
            }),
          )
          .optional(),
      }),
    ),
  }),
);
export default async function Register() {
  const { user } = await pageIdentity("/opportunities/register");
  try {
    requireModule(user, "opportunities-group");
  } catch {
    return <State title="Access denied" code="FORBIDDEN" />;
  }
  const { session } = await authenticate();
  let forms;
  try {
    forms = definitions.parse(
      await oracle("getProposalEthical_dynFormsP_ref_module", {
        token: session.token,
        p_obj_type: "PROPOSAL",
        p_ref_module: "SPORT-ENGLAND-USER-REG",
      }),
    );
  } catch (error) {
    const e = publicError(error);
    return (
      <State
        title="Registration configuration unavailable"
        message={e.message}
        code={e.code}
      />
    );
  }
  return (
    <section className="eoi-workspace">
      <div className="home-context">
        <div>
          <h1>Register</h1>
          <p>Please enter all the required information</p>
        </div>
        <Link className="button" href="/opportunities">
          Cancel
        </Link>
      </div>
      <State
        title="Registration submission is awaiting backend setup"
        message="This source page uses the SPORT-ENGLAND-USER-REG form and VBCS Employee Business Object. The Employee schema and approved server authentication must be confirmed before registration can submit."
        code="CONFIGURATION"
      />
      {forms.length ? (
        forms.map((form) => (
          <section key={form.formId} className="eoi-form">
            <h2>{form.formName}</h2>
            {form.sections
              .filter((section) => section.isVisible === "Y")
              .map((section) => (
                <section key={section.sectionId}>
                  <h3>{section.sectionName}</h3>
                  <ul>
                    {section.fields
                      ?.filter((field) => field.isVisible === "Y")
                      .map((field) => (
                        <li key={field.fieldId}>{field.description}</li>
                      ))}
                  </ul>
                </section>
              ))}
          </section>
        ))
      ) : (
        <p>No customer registration form is currently configured.</p>
      )}
    </section>
  );
}
