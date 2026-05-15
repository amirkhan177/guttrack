"use client";

import {
  SectionLabel,
  Card,
  FieldLabel,
} from "./SettingsUI";

interface HealthProfileSectionProps {
  age: string;
  setAge: (val: string) => void;
  heightFt: string;
  setHeightFt: (val: string) => void;
  heightIn: string;
  setHeightIn: (val: string) => void;
  ethnicity: string;
  setEthnicity: (val: string) => void;
  profileSaving: boolean;
  saveHealthProfile: () => void;
}

export function HealthProfileSection({
  age,
  setAge,
  heightFt,
  setHeightFt,
  heightIn,
  setHeightIn,
  ethnicity,
  setEthnicity,
  profileSaving,
  saveHealthProfile,
}: HealthProfileSectionProps) {
  return (
    <>
      <SectionLabel>Health Profile</SectionLabel>
      <Card>
        <p style={{ color: "#555", fontSize: 11, fontFamily: "SF Mono, monospace", marginBottom: 12 }}>
          Used by AI to personalize gut health insights
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <FieldLabel>Age</FieldLabel>
            <input
              type="number"
              value={age}
              onChange={e => setAge(e.target.value)}
              placeholder="e.g. 34"
              min={1} max={120}
              style={{
                width: "100%", padding: "10px 14px", borderRadius: 10,
                background: "#0A0A0F", border: `1px solid #1e1e2e`,
                color: "#e8e8f0", fontSize: 14, outline: "none",
              }}
            />
          </div>

          <div>
            <FieldLabel>Height</FieldLabel>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1, position: "relative" }}>
                <input
                  type="number"
                  value={heightFt}
                  onChange={e => setHeightFt(e.target.value)}
                  placeholder="5"
                  min={0} max={9}
                  style={{
                    width: "100%", padding: "10px 14px", borderRadius: 10,
                    background: "#0A0A0F", border: `1px solid #1e1e2e`,
                    color: "#e8e8f0", fontSize: 14, outline: "none",
                  }}
                />
                <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "#555", fontSize: 11, fontFamily: "SF Mono, monospace" }}>ft</span>
              </div>
              <div style={{ flex: 1, position: "relative" }}>
                <input
                  type="number"
                  value={heightIn}
                  onChange={e => setHeightIn(e.target.value)}
                  placeholder="10"
                  min={0} max={11}
                  style={{
                    width: "100%", padding: "10px 14px", borderRadius: 10,
                    background: "#0A0A0F", border: `1px solid #1e1e2e`,
                    color: "#e8e8f0", fontSize: 14, outline: "none",
                  }}
                />
                <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "#555", fontSize: 11, fontFamily: "SF Mono, monospace" }}>in</span>
              </div>
            </div>
          </div>

          <div>
            <FieldLabel>Ethnicity</FieldLabel>
            <select
              value={ethnicity}
              onChange={e => setEthnicity(e.target.value)}
              style={{
                width: "100%", padding: "10px 14px", borderRadius: 10,
                background: "#0A0A0F", border: `1px solid #1e1e2e`,
                color: ethnicity ? "#e8e8f0" : "#555", fontSize: 14, outline: "none",
                appearance: "none", cursor: "pointer",
              }}
            >
              <option value="">Select...</option>
              <option value="Asian">Asian</option>
              <option value="Black / African American">Black / African American</option>
              <option value="Hispanic / Latino">Hispanic / Latino</option>
              <option value="Middle Eastern / North African">Middle Eastern / North African</option>
              <option value="Native American / Alaska Native">Native American / Alaska Native</option>
              <option value="Pacific Islander">Pacific Islander</option>
              <option value="South Asian">South Asian</option>
              <option value="White / Caucasian">White / Caucasian</option>
              <option value="Mixed / Multiracial">Mixed / Multiracial</option>
              <option value="Prefer not to say">Prefer not to say</option>
            </select>
          </div>

          <button
            onClick={saveHealthProfile}
            disabled={profileSaving}
            style={{
              width: "100%", padding: "12px", borderRadius: 10,
              border: `1px solid #7EB8A4`, background: "transparent",
              color: "#7EB8A4", fontFamily: "SF Mono, monospace", fontSize: 11,
              cursor: "pointer", opacity: profileSaving ? 0.5 : 1,
              letterSpacing: "0.1em",
            }}
          >
            {profileSaving ? "SAVING..." : "SAVE HEALTH PROFILE"}
          </button>
        </div>
      </Card>
    </>
  );
}
