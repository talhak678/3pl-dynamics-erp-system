import { useEffect, useMemo, useState } from 'react';

import { DatePicker, Form, Input, Modal, Segmented, Select, Typography } from 'antd';

import dayjs from 'dayjs';

import { request } from '@/request';

const { Text } = Typography;

export const FOLLOW_UP_CHANNELS = ['Call', 'Email', 'Meeting', 'WhatsApp', 'SMS', 'Visit', 'Other'];

/**
 * A populated reference arrives as a document; an unpopulated one as an id.
 * `FollowUp` declares lead/client autopopulate, so the module's edit path always
 * hands this component the document shape.
 */
const idOf = (value) => (value && typeof value === 'object' ? value._id : value);

const DEFAULT_TIME = () => dayjs().add(1, 'day').hour(9).minute(0).second(0).millisecond(0);

const nameOfLead = (lead) => lead?.name || lead?.email || 'Unnamed lead';
const nameOfClient = (client) => client?.name || client?.email || 'Unnamed customer';

/**
 * The one form that schedules, edits and completes a follow-up.
 *
 * Shared by the Sales Follow-ups module and the pipeline board's drawer, and it
 * writes through /api/followup/* in both places. That is the point: the board and
 * the dedicated screen are two views of one collection, and a second form posting
 * somewhere else would be the first step back toward two datasets that disagree.
 *
 * The link is exactly one of a lead or a customer, because that is what the
 * controller validates. `lockTarget` is used by the board, where the lead is the
 * card that was clicked rather than a choice.
 *
 * The form is reset on every open rather than destroyed, so opening "create"
 * after editing a record cannot inherit its values. The date defaults to 09:00
 * tomorrow - a follow-up scheduled "now" is already due, which is the opposite of
 * what the screen is for.
 */
export default function FollowUpModal({
  open,
  onClose,
  onSaved,
  followUp,
  initialLead,
  leads = [],
  clients = [],
  lockTarget = false,
}) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const isEdit = Boolean(followUp);

  const defaultType = useMemo(() => {
    if (followUp) return idOf(followUp.client) ? 'client' : 'lead';
    return 'lead';
  }, [followUp]);

  const defaultTargetId = useMemo(() => {
    if (followUp) {
      const id = idOf(followUp.client) || idOf(followUp.lead);
      return id ? String(id) : undefined;
    }
    return initialLead?._id ? String(initialLead._id) : undefined;
  }, [followUp, initialLead]);

  const watchedType = Form.useWatch('targetType', form);
  const targetType = watchedType || defaultType;

  /*
   * Options are a union rather than one source, because three different states
   * can put a record in the picker: the fetched workspace list, the lead whose
   * card opened this modal, and the already-linked record when editing. Without
   * the last two an edit of an old follow-up would render a blank selection for
   * a lead that the list does not contain - either because it is out of the
   * caller's scope or because it was created after the list was fetched.
   */
  const leadOptions = useMemo(() => {
    const map = new Map();

    for (const lead of leads ?? []) map.set(String(lead._id), nameOfLead(lead));

    if (initialLead?._id) map.set(String(initialLead._id), nameOfLead(initialLead));

    const linked = followUp ? followUp.lead : null;
    if (linked && typeof linked === 'object') map.set(String(linked._id), nameOfLead(linked));

    return [...map].map(([value, label]) => ({ value, label }));
  }, [leads, initialLead, followUp]);

  const clientOptions = useMemo(() => {
    const map = new Map();

    for (const client of clients ?? []) map.set(String(client._id), nameOfClient(client));

    const linked = followUp ? followUp.client : null;
    if (linked && typeof linked === 'object') map.set(String(linked._id), nameOfClient(linked));

    return [...map].map(([value, label]) => ({ value, label }));
  }, [clients, followUp]);

  useEffect(() => {
    if (!open) return;

    form.resetFields();
    form.setFieldsValue({
      targetType: defaultType,
      targetId: defaultTargetId,
      channel: followUp?.channel || 'Call',
      date: followUp?.date ? dayjs(followUp.date) : DEFAULT_TIME(),
      subject: followUp?.subject || '',
      notes: followUp?.notes || '',
      outcome: followUp?.outcome || '',
      status: followUp?.completed ? 'completed' : 'pending',
    });
  }, [open, followUp, defaultType, defaultTargetId, form]);

  const handleFinish = async (values) => {
    setSaving(true);

    try {
      const payload = {
        lead: values.targetType === 'lead' ? values.targetId : null,
        client: values.targetType === 'client' ? values.targetId : null,
        channel: values.channel,
        date: values.date.toISOString(),
        subject: values.subject || undefined,
        notes: values.notes || undefined,
        outcome: values.outcome || undefined,
      };

      // Status is only editable on an existing record. A new follow-up is
      // always pending; marking one complete at creation would record a
      // completion that never happened.
      if (isEdit) payload.completed = values.status === 'completed';

      const data = isEdit
        ? await request.update({ entity: 'followup', id: followUp._id, jsonData: payload })
        : await request.create({ entity: 'followup', jsonData: payload });

      if (data?.success) {
        onSaved?.(data.result);
        onClose?.();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={isEdit ? 'Edit Follow-up' : 'Schedule Follow-up'}
      open={open}
      onCancel={saving ? undefined : onClose}
      onOk={() => form.submit()}
      okText={isEdit ? 'Save Changes' : 'Schedule'}
      confirmLoading={saving}
      cancelButtonProps={{ disabled: saving }}
      maskClosable={!saving}
      width={620}
    >
      <Form form={form} layout="vertical" onFinish={handleFinish} requiredMark="optional">
        <Form.Item name="targetType" label="Linked to" hidden={lockTarget}>
          <Segmented
            block
            options={[
              { label: 'Lead', value: 'lead' },
              { label: 'Customer', value: 'client' },
            ]}
            onChange={() => form.setFieldsValue({ targetId: undefined })}
          />
        </Form.Item>

        {/* The hidden field above still owns the value while locked; keeping a
            visible, disabled select is what tells the reader which lead this is. */}
        {lockTarget && (
          <Form.Item label="Linked lead">
            <Select
              disabled
              value={defaultTargetId}
              options={leadOptions}
              placeholder="The lead this card belongs to"
            />
          </Form.Item>
        )}

        <Form.Item
          name="targetId"
          label={targetType === 'client' ? 'Customer' : 'Lead'}
          hidden={lockTarget}
          rules={[
            {
              required: true,
              message: `Select the ${targetType === 'client' ? 'customer' : 'lead'} this follow-up is for`,
            },
          ]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            placeholder={targetType === 'client' ? 'Choose a customer' : 'Choose a lead'}
            options={targetType === 'client' ? clientOptions : leadOptions}
            notFoundContent={
              <Text type="secondary">
                {targetType === 'client'
                  ? 'No customers are available to attach a follow-up to.'
                  : 'No leads are available to attach a follow-up to.'}
              </Text>
            }
          />
        </Form.Item>

        <Form.Item
          name="channel"
          label="Channel"
          rules={[{ required: true, message: 'Choose how this follow-up happens' }]}
        >
          <Select
            options={FOLLOW_UP_CHANNELS.map((channel) => ({ value: channel, label: channel }))}
          />
        </Form.Item>

        <Form.Item
          name="date"
          label="Due date & time"
          rules={[{ required: true, message: 'Choose when this follow-up is due' }]}
        >
          <DatePicker
            showTime
            format="DD/MM/YYYY HH:mm"
            style={{ width: '100%' }}
            disabledDate={(current) => current && current.isBefore(dayjs().startOf('day')) && !isEdit}
          />
        </Form.Item>

        <Form.Item name="subject" label="Subject">
          <Input placeholder="e.g. Confirm proposal details" maxLength={140} />
        </Form.Item>

        <Form.Item name="notes" label="Notes">
          <Input.TextArea rows={3} placeholder="What needs to be discussed?" maxLength={2000} />
        </Form.Item>

        {isEdit && (
          <>
            <Form.Item name="status" label="Status">
              <Segmented
                block
                options={[
                  { label: 'Pending', value: 'pending' },
                  { label: 'Completed', value: 'completed' },
                ]}
              />
            </Form.Item>

            <Form.Item
              name="outcome"
              label="Outcome"
              extra="Saved with the record so the next person knows what came of it."
            >
              <Input.TextArea rows={2} placeholder="What came of this follow-up?" maxLength={2000} />
            </Form.Item>
          </>
        )}
      </Form>
    </Modal>
  );
}
