import type { ChangeEvent } from "react";

import styles from "./FormCheckbox.module.css";

interface FormCheckbox {
    id: string;
    label: string;
    checked: boolean;
    onChange: (e: ChangeEvent<HTMLInputElement>) => void;
}

export default function FormCheckbox({ id, label, checked, onChange }: FormCheckbox) {
    return (
        <div className={styles.container}>
            <label className={styles.checkBox}>
                <input
                    id={id}
                    type="checkbox"
                    className={styles.checkInput}
                    checked={checked}
                    onChange={onChange}
                />

                <span className={styles.transition} />
            </label>

            <label htmlFor={id}>
                {label}
            </label>
        </div>
    );
}