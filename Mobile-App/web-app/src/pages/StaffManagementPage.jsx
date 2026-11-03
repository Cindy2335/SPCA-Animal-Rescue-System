import { Plus, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { useState } from "react";

const emptyForm = {
  email: "",
  fullname: "",
  password: "",
  role: "FIELD_AGENT",
};

export default function StaffManagementPage({ busy, busyId, currentUserId, onCreate, onDelete, workers }) {
  const [form, setForm] = useState(emptyForm);

  async function handleSubmit(event) {
    event.preventDefault();
    await onCreate(form);
    setForm(emptyForm);
  }

  return (
    <section className="admin-dataset-page staff-management-page">
      <article className="panel staff-list-card">
        <div className="panel-header">
          <div>
            <h2>Staff members</h2>
            <p>Manage administrators and field agents who can respond to reports.</p>
          </div>
        </div>

        <div className="dataset-table-wrap">
          <table className="dataset-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {workers.map((worker) => (
                <tr key={worker.id}>
                  <td><strong>{worker.fullName}</strong></td>
                  <td>{worker.email}</td>
                  <td>
                    <span className={`status-pill ${worker.role === "ADMIN" ? "approved" : "review"}`}>
                      {worker.role === "FIELD_AGENT" ? "Field agent" : "Admin"}
                    </span>
                  </td>
                  <td>
                    <button
                      aria-label={`Remove ${worker.fullName}`}
                      className="icon-button"
                      disabled={worker.id === currentUserId || busyId === worker.id}
                      onClick={() => {
                        if (window.confirm(`Remove ${worker.fullName} from staff?`)) {
                          onDelete(worker);
                        }
                      }}
                      title={worker.id === currentUserId ? "You cannot remove your own account" : "Remove staff member"}
                      type="button"
                    >
                      <Trash2 size={17} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <article className="panel staff-create-card">
        <div className="panel-header">
          <div>
            <h2>Add staff member</h2>
            <p>The new staff member can sign in immediately with these credentials.</p>
          </div>
        </div>
        <form className="management-form staff-create-form" onSubmit={handleSubmit}>
          <label>
            <span>Full name</span>
            <input required value={form.fullname} onChange={(event) => setForm({ ...form, fullname: event.target.value })} />
          </label>
          <label>
            <span>Email</span>
            <input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </label>
          <label>
            <span>Temporary password</span>
            <input minLength={8} required type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
          </label>
          <label>
            <span>Role</span>
            <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
              <option value="FIELD_AGENT">Field agent</option>
              <option value="ADMIN">Administrator</option>
            </select>
          </label>
          <button className="primary-button" disabled={busy} type="submit">
            {form.role === "ADMIN" ? <ShieldCheck size={18} /> : <UserRound size={18} />}
            <Plus size={18} />
            {busy ? "Creating..." : "Add staff member"}
          </button>
        </form>
      </article>
    </section>
  );
}
