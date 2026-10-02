import { useEffect, useState } from 'react';

import { Button, DatePicker, Modal, Radio, Space } from 'antd';
import { CalendarOutlined, UndoOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

import useLanguage from '@/locale/useLanguage';
import useDate from '@/settings/useDate';

import {
  DATE_RANGE_PRESETS,
  PRESET_DESCRIPTIONS,
  PRESET_LABELS,
  isCustomRangeValid,
} from '@/utils/dateRange';

/** The muted style the secondary line on each option shares. */
const hintStyle = { color: '#8c8c8c', marginLeft: 8, fontSize: 12 };

/**
 * The dashboard header's Date Range control, and the dialog behind it.
 *
 * The dialog is a draft: the radio and the two date pickers are copies, and
 * nothing reaches the dashboard until Apply is pressed. That is what keeps the
 * page from re-fetching every summary on the click of an option the user is
 * still deciding about, and it is why closing without applying leaves the cards
 * exactly as they were.
 *
 * Reset is the one deliberate exception, and it is not really an exception: it
 * is a second way to commit, not a way to edit the draft. Both buttons mean "do
 * this now" and both close the dialog, so there is no state left on screen that
 * a pending Apply could still contradict. Reset also clears the custom dates, so
 * reopening on Custom starts empty rather than restoring the window the user
 * just dismissed.
 *
 * The From and To pickers refuse dates that would put the pair the wrong way
 * round, so an impossible window cannot be built in the first place. Apply stays
 * disabled for it anyway - the pickers are the only way to fill these in today,
 * but they are not the only way one could ever be filled in, and an invalid pair
 * would be applied as "no window at all", which reads on screen as every record
 * ever rather than as a mistake.
 */
export default function DateRangeFilter({ preset, custom, description, onApply, onReset }) {
  const translate = useLanguage();
  const { dateFormat } = useDate();

  const [open, setOpen] = useState(false);
  const [draftPreset, setDraftPreset] = useState(preset);
  const [draftCustom, setDraftCustom] = useState(custom);

  /*
   * The draft is taken from the applied state each time the dialog opens, and
   * only then. Re-running while it is open would overwrite whatever the user had
   * just chosen - and it would do so on the render after Apply, briefly showing
   * the dialog's own result back to it as if it were a new edit.
   */
  useEffect(() => {
    if (!open) return;

    setDraftPreset(preset);
    setDraftCustom(custom);
  }, [open, preset, custom]);

  const isCustom = draftPreset === 'custom';
  const canApply = !isCustom || isCustomRangeValid(draftCustom);

  const close = () => setOpen(false);

  const handleApply = () => {
    if (!canApply) return;

    onApply(draftPreset, draftCustom);
    close();
  };

  const handleReset = () => {
    onReset();
    close();
  };

  const setFrom = (value) => setDraftCustom((current) => ({ ...current, from: value }));

  const setTo = (value) => setDraftCustom((current) => ({ ...current, to: value }));

  return (
    <>
      <Button icon={<CalendarOutlined />} onClick={() => setOpen(true)}>
        {`${translate('Date Range')} · ${description}`}
      </Button>

      <Modal
        title={translate('Date Range')}
        open={open}
        onCancel={close}
        footer={
          /*
           * Written as one element rather than the footer array, so Reset sits
           * on the left of the row and the two committing buttons stay together
           * on the right. A destructive-looking action next to Apply is the one
           * arrangement worth avoiding here.
           */
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Button icon={<UndoOutlined />} onClick={handleReset}>
              {translate('Reset')}
            </Button>
            <Space>
              <Button onClick={close}>{translate('Cancel')}</Button>
              <Button type="primary" onClick={handleApply} disabled={!canApply}>
                {translate('Apply')}
              </Button>
            </Space>
          </div>
        }
      >
        <Radio.Group
          value={draftPreset}
          onChange={(event) => setDraftPreset(event.target.value)}
          style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          {DATE_RANGE_PRESETS.map((option) => (
            <Radio key={option} value={option}>
              {PRESET_LABELS[option]}
              <span style={hintStyle}>{PRESET_DESCRIPTIONS[option]}</span>
            </Radio>
          ))}
        </Radio.Group>

        {isCustom && (
          <Space direction="vertical" size="middle" style={{ width: '100%', marginTop: 20 }}>
            <div>
              <div style={{ marginBottom: 6 }}>{translate('From')}</div>
              <DatePicker
                style={{ width: '100%' }}
                format={dateFormat}
                value={draftCustom.from}
                onChange={setFrom}
                // No day after `to`, so the pair can only ever read forwards.
                disabledDate={(current) =>
                  Boolean(current && draftCustom.to && current.isAfter(dayjs(draftCustom.to), 'day'))
                }
              />
            </div>
            <div>
              <div style={{ marginBottom: 6 }}>{translate('To')}</div>
              <DatePicker
                style={{ width: '100%' }}
                format={dateFormat}
                value={draftCustom.to}
                onChange={setTo}
                disabledDate={(current) =>
                  Boolean(
                    current && draftCustom.from && current.isBefore(dayjs(draftCustom.from), 'day')
                  )
                }
              />
            </div>
          </Space>
        )}
      </Modal>
    </>
  );
}
