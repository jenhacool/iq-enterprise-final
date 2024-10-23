import {
  Layout,
  LegacyCard,
  Page,
  PageActions,
  Frame,
  Toast,
  FormLayout,
  TextField,
  Link,
  Button,
  Icon,
  DataTable,
  Modal,
} from '@shopify/polaris';
import { CancelSmallMinor } from '@shopify/polaris-icons';
import React, { useState, useEffect, useCallback } from 'react';
import { useFormik } from 'formik';
import { CSVDownload, CSVLink } from 'react-csv';
import moment from 'moment';

export default function Index({ shop, authAxios }) {
  const [active, setActive] = useState(false);
  const [logs, setLogs] = useState(true);

  const formik = useFormik({
    initialValues: {
      api: "",
      terminal_number: "",
      username: "",
      password: "",
      interval: 60,
      company_codes: [''],
      location: 0,
    }
  });

  const handleChange = (value, id) => {
    formik.handleChange({ target: { id, value } });
  };

  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    try {
      setLoading(true);
      await authAxios.post("/api/setting", {
        ...formik.values
      });
      setLoading(false);
      toggleActive();
    } catch(error) {
      console.log(error);
      setLoading(false);
    }
  }

  const getSetting = async () => {
    try {
      setLoading(true);
      const response = await authAxios.get("/api/setting");
      const setting = response.data.data;
      console.log(setting);
      formik.setValues(setting);
      setLoading(false);
    } catch(error) {
      setLoading(false);
      console.log(error);
    }
  }

  const getLogs = async () => {
    try {
      setLoading(true);
      const response = await authAxios.get("/api/log");
      const logs = response.data.data;
      setLogs(logs);
      setLoading(false);
    } catch(error) {
      setLoading(false);
      console.log(error);
    }
  }

  const syncData = async () => {
    try {
      setLoading(true);
      await authAxios.post("/api/sync_data");
      setLoading(false);
    } catch(error) {
      setLoading(false);
      console.log(error);
    }
  }

  useEffect(()=>{
    getSetting()
    getLogs();
  }, [])

  const removeCompanyCode = (index) => {
    let company_codes = formik.values.company_codes;
    company_codes = company_codes.splice(index, 1);
    handleChange("company_codes", company_codes);
  }

  const toggleActive = useCallback(() => setActive((active) => !active), []);

  const toastMarkup = active ? (
    <Toast content="Setting saved" onDismiss={toggleActive} />
  ) : null;

  const rows = () => {
    if (logs.length) {
      return logs.map((log) => {
        let headers = ["log"]
        let data = log.logs.map((l) => ({
          log: l
        }));
        let date = moment(log.createdAt).format("YYYY-MM-DD hh:mm:ss");
        return [
          date,
          log.status.toUpperCase(),
          <CSVLink data={data} headers={headers} filename={`${date}.csv`}>
            View detail
          </CSVLink>
        ]
      })
    }
  }

  const viewLogDetail = (_id) => {

  }

  return (
    <Frame>
      <Page>
        <Layout>
          <Layout.Section>
            <LegacyCard title="Settings" sectioned primaryFooterAction={{
              content: 'Save',
              onAction: onSubmit,
              loading: loading,
            }}>
              <FormLayout>
                <TextField
                  label="Sync interval"
                  suffix="minute(s)"
                  type="number"
                  value={formik.values?.interval}
                  onChange={handleChange}
                  name="interval"
                  id="interval"
                />
                <div>
                  <p style={{ marginBottom: "var(--p-space-1)" }}>Company code</p>
                  {formik.values?.company_codes.map((code, index) => {
                    return (
                      <div style={{ marginBottom: "var(--p-space-2)" }}>
                        <TextField
                          key={index}
                          value={code}
                          onChange={(e) => {
                            const companyCodes = [...formik.values.company_codes];
                            companyCodes[index] = e;
                            formik.setFieldValue('company_codes', companyCodes);
                          }}
                          connectedRight={
                            <Button onClick={() => removeCompanyCode(index)}><Icon source={CancelSmallMinor} tone="base" /></Button>
                          }
                        />
                      </div>
                    );
                  })}
                  <Button onClick={() => formik.setFieldValue('company_codes', [...formik.values.company_codes, ''])}>
                    Add company code
                  </Button>
                </div>
                <TextField
                  label="Location ID"
                  type="number"
                  value={formik.values?.location}
                  onChange={handleChange}
                  name="location"
                  id="location"
                />
                <TextField
                  label="API URL"
                  value={formik.values?.api}
                  onChange={handleChange}
                  name="api"
                  id="api"
                />
                <TextField
                  label="API Username"
                  value={formik.values?.username}
                  onChange={handleChange}
                  name="username"
                  id="username"
                />
                <TextField
                  label="API Password"
                  value={formik.values?.password}
                  onChange={handleChange}
                  name="password"
                  id="password"
                />
                <TextField
                  label="Terminal number"
                  value={formik.values?.terminal_number}
                  onChange={handleChange}
                  name="terminal_number"
                  id="terminal_number"
                />
              </FormLayout>
            </LegacyCard>
            <LegacyCard title="Actions" sectioned>
              <FormLayout>
                <Button onClick={syncData} loading={loading}>Sync data</Button>
              </FormLayout>
            </LegacyCard>
            <LegacyCard>
              {logs.length &&
                <DataTable
                  columnContentTypes={[
                    "text",
                    "text",
                    "text"
                  ]}
                  headings={[
                    "Date",
                    "Status",
                    "Detail"
                  ]}
                  rows={rows()}
                />
              }
            </LegacyCard>
          </Layout.Section>
        </Layout>
        {toastMarkup}
      </Page>
    </Frame>
  );
}
