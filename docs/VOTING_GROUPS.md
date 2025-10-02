# Voting Groups Configuration

## Overview

The Voting Groups feature allows you to automatically group employees for voting purposes based on configurable criteria. This enables you to create separate voting contexts for different organizational units, locations, or custom groupings.

## How It Works

When employees are synchronized from Azure AD and/or ADP (CSV), the system automatically assigns a `votingGroup` to each employee based on the configured strategy. This field can then be used to:

- Filter nominees and voters by group
- Create location or department-specific voting periods
- Generate reports segmented by voting group
- Implement organizational hierarchy in voting processes

## Configuration

### Environment Variables

Add the following configuration to your `.env` file:

```env
# Strategy for grouping employees: 'location', 'department', or 'custom'
VOTING_GROUP_STRATEGY=location

# Custom mappings (JSON format) - only used when strategy is 'custom'
VOTING_GROUP_CUSTOM_MAPPINGS=
```

### Available Strategies

#### 1. Location-Based Grouping (`location`)

Groups employees by their office location from Azure AD.

**Configuration:**
```env
VOTING_GROUP_STRATEGY=location
```

**Example Result:**
- Employee at "Santo Domingo" → `votingGroup: "Santo Domingo"`
- Employee at "Santiago" → `votingGroup: "Santiago"`
- Employee at "Puerto Plata" → `votingGroup: "Puerto Plata"`

**Use Case:** Regional voting, location-specific awards, office-based competitions

---

#### 2. Department-Based Grouping (`department`)

Groups employees by their department from Azure AD or ADP.

**Configuration:**
```env
VOTING_GROUP_STRATEGY=department
```

**Example Result:**
- Employee in "Engineering" → `votingGroup: "Engineering"`
- Employee in "Sales" → `votingGroup: "Sales"`
- Employee in "Human Resources" → `votingGroup: "Human Resources"`

**Use Case:** Department-specific recognition, cross-functional competitions, departmental awards

---

#### 3. Custom Mapping (`custom`)

Allows you to define custom groupings by mapping multiple locations or departments to the same voting group.

**Configuration:**
```env
VOTING_GROUP_STRATEGY=custom
VOTING_GROUP_CUSTOM_MAPPINGS={"Santo Domingo,Santiago":"Región Sur","Puerto Plata,La Vega":"Región Norte"}
```

**Mapping Format:**

The `VOTING_GROUP_CUSTOM_MAPPINGS` value must be a valid JSON object where:
- **Keys**: Comma-separated list of locations or departments (case-insensitive)
- **Values**: The voting group name to assign

**Example Result:**
- Employee at "Santo Domingo" → `votingGroup: "Región Sur"`
- Employee at "Santiago" → `votingGroup: "Región Sur"`
- Employee at "Puerto Plata" → `votingGroup: "Región Norte"`
- Employee at "La Vega" → `votingGroup: "Región Norte"`
- Employee at "Punta Cana" (not mapped) → `votingGroup: "Punta Cana"` (defaults to location)

**Use Case:** Multi-location regions, business unit groupings, geographic zones

---

## Examples

### Example 1: Simple Location Grouping

```env
VOTING_GROUP_STRATEGY=location
```

All employees will be grouped by their exact office location.

### Example 2: Regional Grouping

```env
VOTING_GROUP_STRATEGY=custom
VOTING_GROUP_CUSTOM_MAPPINGS={"Santo Domingo,San Cristóbal,Baní":"Zona Metropolitana","Santiago,Puerto Plata,La Vega":"Región Cibao","Punta Cana,La Romana":"Región Este"}
```

This creates three regional groups combining multiple office locations.

### Example 3: Business Unit Grouping

```env
VOTING_GROUP_STRATEGY=custom
VOTING_GROUP_CUSTOM_MAPPINGS={"Engineering,Product,IT":"Technology","Sales,Marketing,Customer Success":"Commercial","HR,Finance,Legal":"Operations"}
```

This groups departments into business units for cross-functional voting.

### Example 4: Department Grouping

```env
VOTING_GROUP_STRATEGY=department
```

Simple department-based grouping using the exact department names from Azure AD.

---

## Data Flow

```
┌─────────────────────┐
│   Azure AD / ADP    │
│   (Data Sources)    │
└──────────┬──────────┘
           │
           │ Employee Sync
           ▼
┌─────────────────────┐
│ VotingGroupService  │
│ (Apply Strategy)    │
└──────────┬──────────┘
           │
           │ Assign votingGroup
           ▼
┌─────────────────────┐
│   Employee Model    │
│ { votingGroup: ... }│
└──────────┬──────────┘
           │
           │ Save to Database
           ▼
┌─────────────────────┐
│   Cosmos DB         │
└─────────────────────┘
```

---

## Implementation Details

### VotingGroupService

The `VotingGroupService` class handles the assignment of voting groups:

- **Strategy**: Configured via `VOTING_GROUP_STRATEGY`
- **Normalization**: Automatically normalizes values (trims whitespace, handles case)
- **Fallback**: If no custom mapping matches, falls back to the employee's location
- **Unknown Handling**: Employees with "Unknown" location/department get `undefined` votingGroup

### Employee Model

The `votingGroup` field is added to the Employee model:

```typescript
interface Employee {
  // ... other fields
  votingGroup?: string;
}
```

### Sync Integration

During employee synchronization (`EmployeeSyncService`):

1. Employees are loaded from CSV/ADP (if available)
2. Employees are enriched with Azure AD data
3. **VotingGroupService assigns voting group** ← Automatic
4. Employees are saved to database with `votingGroup` populated

---

## Usage in Voting Logic

Once employees have `votingGroup` assigned, you can use it in your voting logic:

### Filter Employees by Group

```typescript
const employeesInGroup = await employeeRepository.findByVotingGroup("Región Sur");
```

### Create Group-Specific Voting Periods

```typescript
const votingPeriod = {
  title: "Best Employee - Región Sur",
  votingGroup: "Región Sur",
  startDate: new Date("2025-10-01"),
  endDate: new Date("2025-10-31")
};
```

### Validate Voting Eligibility

```typescript
// Only employees in the same voting group can vote
if (voter.votingGroup !== nominee.votingGroup) {
  throw new Error("Cannot vote for employees outside your voting group");
}
```

---

## Best Practices

1. **Choose the Right Strategy**
   - Use `location` for simple geographic grouping
   - Use `department` for organizational structure
   - Use `custom` for complex multi-level groupings

2. **Test Custom Mappings**
   - Validate your JSON format before deployment
   - Check that all expected locations/departments are mapped
   - Review unmapped employees after sync

3. **Handle Edge Cases**
   - Employees with no location or department will have `undefined` votingGroup
   - Consider how to handle employees who transfer between groups
   - Plan for new locations or departments that may appear

4. **Update Strategy Carefully**
   - Changing strategy requires re-syncing all employees
   - Backup data before major configuration changes
   - Communicate changes to users if grouping affects active voting periods

---

## Troubleshooting

### Issue: Employees not getting assigned to voting groups

**Solution:**
- Check that `VOTING_GROUP_STRATEGY` is set correctly
- Verify employees have `location` or `department` populated from Azure AD
- Review sync logs for VotingGroupService messages

### Issue: Custom mappings not working

**Solution:**
- Validate JSON format using a JSON validator
- Ensure keys match exactly (check for typos, extra spaces)
- Verify `VOTING_GROUP_STRATEGY=custom` is set
- Check logs for parsing errors

### Issue: Wrong employees grouped together

**Solution:**
- Review custom mappings for unintended key overlaps
- Check that Azure AD data is correct
- Re-sync employees after fixing configuration

---

## API Integration

### Get Voting Groups

To retrieve all unique voting groups:

```typescript
const groups = await employeeRepository.findDistinctVotingGroups();
```

### Filter by Voting Group

```typescript
const employees = await employeeRepository.findAll({
  votingGroup: "Región Sur"
});
```

---

## Migration Guide

If you're adding voting groups to an existing system:

1. **Add Configuration**
   ```env
   VOTING_GROUP_STRATEGY=location
   ```

2. **Run Full Sync**
   ```bash
   POST /api/employees/sync
   ```

3. **Verify Assignment**
   - Check employee records in Cosmos DB
   - Verify `votingGroup` field is populated

4. **Update Voting Logic**
   - Add voting group filters to voting endpoints
   - Update UI to show voting group information

---

## Future Enhancements

Potential future improvements to voting groups:

- **Dynamic Groups**: Allow runtime group creation without restart
- **Hierarchical Groups**: Support parent-child group relationships
- **Group Permissions**: Define which groups can vote for which groups
- **Auto-Discovery**: Automatically detect new locations/departments
- **Group Admin UI**: Web interface for managing voting group mappings

---

## Support

For questions or issues with voting groups:

1. Check the logs for VotingGroupService messages
2. Review this documentation
3. Contact the development team
4. File an issue on the project repository