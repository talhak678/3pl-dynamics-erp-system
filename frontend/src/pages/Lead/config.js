import { selectColor } from '@/utils/color';
import { SALES_STAGES } from '@/utils/salesStages';

/**
 * The pipeline stages, as options for this list's Status column.
 *
 * Built from the board's own list rather than written out a second time. That
 * is the whole fix for the bug this column had: the two surfaces each kept
 * their own idea of what a stage is called, the spellings drifted apart by case
 * ('Won' on the board, 'won' here) and by more than case ('Lost' versus
 * 'loose'), and `selectWithTranslation` matches a stored value to its option
 * with an exact ===. So half of what the board wrote rendered here as a bare
 * uncoloured tag, and half of what this select wrote never moved a card.
 *
 * The label is the value rather than SALES_STAGES' own label, because the board
 * styles 'Meeting / Demo' with spaces around the slash and this column has
 * always shown 'Meeting/Demo'. The part the exact match depends on is the
 * value, and that is identical either way, so there is nothing to gain by
 * changing what this column reads.
 */
const stageOptions = SALES_STAGES.map(({ value, color }) => ({ value, label: value, color }));

export const fields = {
  type: {
    type: 'selectWithFeedback',
    renderAsTag: true,
    options: [
      { value: 'people', label: 'people', color: 'magenta' },
      { value: 'company', label: 'company', color: 'blue' },
    ],
    required: true,
    hasFeedback: true,
  },
  name: {
    type: 'string',
    disableForForm: true,
  },
  /**
   * The lead's lifecycle status, as the leads list renders it.
   *
   * Two kinds of value live in this one field, and the split is deliberate.
   *
   * The five at the top are lifecycle states that are not pipeline stages and
   * have no stage they could become - a lead that is 'canceled' or 'on hold' is
   * not somewhere on the board, and the sync leaves those values untouched.
   *
   * Everything below them is a pipeline stage, taken from the board's list. A
   * stage written by the board has to be renderable here, and a stage chosen
   * here has to move the card, so the two surfaces have to agree on the
   * spelling exactly - which is why this is derived rather than re-typed.
   *
   * Picking one of these here therefore moves the lead on the board. That is
   * the intended behaviour and the point of the fix: see
   * backend/.../leadController/stageSync.js, which writes the chosen stage into
   * `salesStage` and `status` together.
   *
   * Leads saved before that fix still hold the old lowercase spellings ('new',
   * 'won', 'loose', 'in negociation'). They render with the right text but no
   * tag colour, because no option matches them, and they normalise to the
   * canonical spelling the next time anyone edits them.
   */
  status: {
    type: 'selectWithTranslation',
    renderAsTag: true,
    options: [
      { value: 'draft', label: 'draft' },
      { value: 'canceled', label: 'canceled', color: selectColor.crimson },
      { value: 'assigned', label: 'assigned', color: selectColor.mediumturquoise },
      { value: 'on hold', label: 'on hold', color: selectColor.burlywood },
      { value: 'waiting', label: 'waiting', color: 'orange' },
      ...stageOptions,
    ],
  },

  source: {
    type: 'selectWithTranslation',
    renderAsTag: true,
    options: [
      { value: 'linkedin', label: 'linkedin', color: selectColor.royalblue },
      { value: 'socialmedia', label: 'social_media', color: selectColor.skyblue },
      { value: 'website', label: 'website', color: selectColor.coral },
      { value: 'advertising', label: 'advertising', color: selectColor.darkgreen },
      { value: 'friend', label: 'friend', color: selectColor.firebrick },
      {
        value: 'professionals network',
        label: 'professionals network',
        color: selectColor.mediumvioletred,
      },

      { value: 'customer referral', label: 'customer referral', color: selectColor.violet },
      { value: 'sales', label: 'sales', color: selectColor.deeppink },
      { value: 'other', label: 'other', color: selectColor.darkgray },
    ],
  },
  country: {
    type: 'country',
    color: null,
    disableForForm: true,
  },
  phone: {
    type: 'phone',
    disableForForm: true,
  },
  email: {
    type: 'email',
    disableForForm: true,
  },
  people: {
    type: 'search',
    label: 'people',
    entity: 'people',
    displayLabels: ['firstname', 'lastname'],
    searchFields: 'firstname,lastname',
    dataIndex: ['people', 'firstname'],
    disableForTable: true,
    feedback: 'people',
  },
  company: {
    type: 'search',
    label: 'company',
    entity: 'company',
    displayLabels: ['name'],
    searchFields: 'name',
    dataIndex: ['company', 'name'],
    disableForTable: true,
    feedback: 'company',
  },
  notes: {
    type: 'textarea',
    disableForTable: true,
  },
  /**
   * Who owns the lead, as a picker over the workspace's employees.
   *
   * `type: 'assignee'` is handled by components/AssigneeSelect, which fetches
   * /api/team and renders nothing at all for an account that may not assign -
   * a Sales Executive's leads are assigned to them by the server, so there is no
   * choice to offer. See leadController/assignment.js.
   *
   * `disableForTable` is required rather than cosmetic. utils/dataStructure.jsx
   * turns every field into a column unless this is set, and the field holds a
   * bare ObjectId - so without it the leads list would gain a column of raw ids,
   * and the value would need resolving per row to be worth reading.
   */
  assignedTo: {
    type: 'assignee',
    label: 'Assign To',
    disableForTable: true,
  },
  /**
   * When the lead is next due to be worked.
   *
   * The pipeline card already renders this and turns it red once the day has
   * passed, and the API has always accepted it - what was missing was any way to
   * set it from the UI, so every card read "No follow-up set".
   *
   * Optional, and left so deliberately: an unset follow-up is a state the card
   * has its own message for, not a gap to be filled in before saving.
   *
   * `type: 'date'` is rendered by DynamicForm, which converts the stored ISO
   * string into the Dayjs a DatePicker requires. See the note there for why the
   * inbound direction needs converting and the outbound one does not.
   *
   * `disableForTable` because utils/dataStructure.jsx turns every field into a
   * column unless it is set. The date already has a home on the pipeline card,
   * and a column here would put the raw stored value in the leads table.
   */
  followUpDate: {
    type: 'date',
    label: 'Follow-Up Date',
    disableForTable: true,
  },
};
