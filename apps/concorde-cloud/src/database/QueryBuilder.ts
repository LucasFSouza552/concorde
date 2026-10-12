
export default class Query {
	private columns: string[] = [];
	private table?: string;
	private conditions: string[] = [];
	private params: unknown[] = [];

	select(...columns: string[]) {
		this.columns = columns;
		return this;
	}

	from(table: string) {
		this.table = table;
		return this;
	}

	where(column: string, operator: string, value: unknown) {
		const index = this.params.length + 1;

		this.conditions.push(`${column} ${operator} $${index}`);
		this.params.push(value);

		return this;
	}

	build() {
		let sql = `SELECT ${this.columns.join(", ")} FROM ${this.table}`;

		if (this.conditions.length > 0) {
			sql += ` WHERE ${this.conditions.join(" AND ")}`;
		}

		return {
			sql,
			params: this.params
		};
	}
}
