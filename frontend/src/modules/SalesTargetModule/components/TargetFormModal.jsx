import { useEffect, useMemo } from 'react';

import {
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Segmented,
  Select,
  Typography,
} from 'antd';

import dayjs from 'dayjs';

const { Text } = Typography;

const { RangePicker } = DatePicker;

export const TARGET_PERIODS = ['Monthly', 'Quarterly', 'Yearly', 'Custom'];
export const TARGET_TYPES = ['Revenue', 'Deals'];

const COMPANY_WIDE = '__company__';

/**
 * The dates a period name implies, so choosing "Monthly" fills the range instead
 * of leaving two more fields to visit. "Custom" intentionally returns undefined -
 * it is the one choice that means the dates are the reader's to pick.
 */
const rangeForPeriod = (period) => {
  const now = dayjs();

  switch (period) {
    case 'Monthly':
      return [now.startOf('month'), now.endOf('month')];

    case 'Quarterly': {
      const firstMonth = Math.floor(now.month() / 3) * 3;
      return [now.month(firstMonth).startOf('month'), now.month(firstMonth + 2).endOf('month')];
    }

    case 'Yearly':
      return [now.startOf('year'), now.endOf('year')];

    default:
      return undefined;
  }
};

/**
 * Create/edit a sales target.
 *
 * The modal only collects the stored fields. The achieved figure is never
 * entered - the server derives it from invoices, orders and won leads inside the
 * target's own period - which is why this form has no "actual" input at all.
 *
 * Assignee is a team member or company-wide. `directory` is null for an account
 * that cannot read /api/team, but only the workspace owner can open this modal in
 * the first place (the server refuses anyone else), so the empty case is a
 * workspace with no employees rather than a permissions limitation.
 */
export default function TargetFormModal({ open, target, directory, submitting, onClose, onSubmit }) {
  const [form] = Form.useForm();
  const isEdit = Boolean(target);

  const assigneeOptions = useMemo(
    () => [
      { value: COMPANY_WIDE, label: 'Company-wide' },
      ...(directory ?? []).map((person) => ({
        value: person.id,
        label: person.name || person.role || 'Team member',
      })),
    ],
    [directory]
  );

  useEffect(() => {
    if (!open) return;

    form.resetFields();

    if (isEdit) {
      form.setFieldsValue({
        title: target.title,
        period: target.period || 'Monthly',
        type: target.type || 'Revenue',
        targetValue: target.targetValue,
        range: [dayjs(target.startDate), dayjs(target.endDate)],
        assignee: target.assignee ? String(target.assignee) : COMPANY_WIDE,
        notes: target.notes || '',
      });
    } else {
      const initialRange = rangeForPeriod('Monthly');

      form.setFieldsValue({
        period: 'Monthly',
        type: 'Revenue',
        targetValue: undefined,
        range: initialRange,
        assignee: COMPANY_WIDE,
        notes: '',
      });
    }
  }, [open, isEdit, target, form]);

  const handlePeriodChange = (period) => {
    const range = rangeForPeriod(period);

    // Only a named period has an implied range. Choosing Custom leaves whatever
    // is in the picker alone, because the reader is about to set it themselves.
    if (range) form.setFieldsValue({ range });
  };

  const handleFinish = (values) => {
    const [start, end] = values.range;

    onSubmit({
      title: values.title,
      period: values.period,
      type: values.type,
      targetValue: values.targetValue,
      startDate: start.startOf('day').toISOString(),
      endDate: end.endOf('day').toISOString(),
      assignee: values.assignee === COMPANY_WIDE ? null : values.assignee,
      notes: values.notes || undefined,
    });
  };

  const type = Form.useWatch('type', form);

  return (
    <Modal
      title={isEdit ? 'Edit Sales Target' : 'New Sales Target'}
      open={open}
      onCancel={submitting ? undefined : onClose}
      onOk={() => form.submit()}
      okText={isEdit ? 'Save Changes' : 'Create Target'}
      confirmLoading={submitting}
      cancelButtonProps={{ disabled: submitting }}
      maskClosable={!submitting}
      width={640}
    >
      <Form form={form} layout="vertical" onFinish={handleFinish} requiredMark="optional">
        <Form.Item
          name="title"
          label="Target title"
          rules={[{ required: true, message: 'Give this target a name' }]}
        >
          <Input placeholder="e.g. Q3 revenue target" maxLength={140} />
        </Form.Item>

        <Form.Item
          name="period"
          label="Period"
          rules={[{ required: true, message: 'Choose a period' }]}
          extra="Monthly, Quarterly and Yearly fill the dates for the current period. Custom lets you choose any window."
        >
          <Segmented
            block
            options={TARGET_PERIODS.map((value) => ({ value, label: value }))}
            onChange={handlePeriodChange}
          />
        </Form.Item>

        <Form.Item
          name="range"
          label="Date range"
          rules={[{ required: true, message: 'Choose the target period' }]}
        >
          <RangePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
        </Form.Item>

        <Form.Item
          name="type"
          label="Target type"
          rules={[{ required: true, message: 'Choose what is being measured' }]}
        >
          <Segmented
            block
            options={[
              { value: 'Revenue', label: 'Revenue amount' },
              { value: 'Deals', label: 'Number of deals' },
            ]}
          />
        </Form.Item>

        <Form.Item
          name="targetValue"
          label={type === 'Deals' ? 'Deals target' : 'Revenue target'}
          rules={[{ required: true, message: 'Enter the target figure' }]}
        >
          <InputNumber
            min={0}
            style={{ width: '100%' }}
            placeholder={type === 'Deals' ? 'e.g. 25' : 'e.g. 100000'}
            precision={type === 'Deals' ? 0 : 2}
          />
        </Form.Item>

        <Form.Item
          name="assignee"
          label="Assign to"
          extra="Company-wide targets count every team member's records. A personal target counts only that person's."
        >
          <Select options={assigneeOptions} placeholder="Company-wide" />
        </Form.Item>

        <Form.Item name="notes" label="Notes">
          <Input.TextArea rows={2} placeholder="Anything the team should know about this target" maxLength={1000} />
        </Form.Item>

        {type === 'Deals' && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            Deals are counted from non-cancelled orders created in the period plus won leads that have not
            been converted to a customer. Converted leads are skipped so one sale is never counted twice.
          </Text>
        )}
      </Form>
    </Modal>
  );
}
